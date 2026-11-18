import {
  deliveryPlan,
  timezone,
  type CalendarItem,
  type DeliveryPreferences,
} from "../../../lapse-api/src/expiration/calendar.ts";
export type Env = {
  supabaseUrl: string;
  serviceKey: string;
  jwtSecret: string;
  cronSecret?: string;
  scheduledEnabled?: boolean;
  expoAccessToken?: string;
};
type Claim = {
  id: string;
  deviceId: string;
  token?: string;
  title: string;
  body: string;
  itemId: string;
  test?: boolean;
  state?: string;
  replayed?: boolean;
};
type Result = {
  id: string;
  deviceId: string;
  state: string;
  ticket?: string;
  invalidToken?: boolean;
};
type Batch = {
  preferences: DeliveryPreferences & {
    user_id: string;
    item_cursor: string | null;
  };
  items: CalendarItem[];
  devices: { id: string }[];
  overrides: { item_id: string; mode: string; offsets: number[] }[];
  lease: string;
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function preferences(value: unknown): DeliveryPreferences {
  const p = value as Partial<DeliveryPreferences> | null;
  if (
    !p ||
    typeof p.enabled !== "boolean" ||
    !Array.isArray(p.offsets) ||
    !p.offsets.length ||
    p.offsets.length > 6 ||
    new Set(p.offsets).size !== p.offsets.length ||
    !p.offsets.every((n) => [0, 1, 3, 7, 14, 30].includes(n)) ||
    !Number.isInteger(p.hour) ||
    p.hour! < 0 ||
    p.hour! > 23 ||
    typeof p.timezone !== "string"
  )
    throw new Error("invalid preferences");
  timezone(p.timezone);
  return p as DeliveryPreferences;
}
export async function verifyJwt(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<{ sub: string; ver: number }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const decode = (value: string) =>
    Uint8Array.from(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (
    header.alg !== "HS256" ||
    !uuid.test(payload.sub ?? "") ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= now / 1000 ||
    (payload.nbf !== undefined &&
      (!Number.isFinite(payload.nbf) || payload.nbf > now / 1000)) ||
    !Number.isInteger(payload.ver ?? 0)
  )
    throw new Error("invalid token");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
  )
    throw new Error("invalid token");
  return { sub: payload.sub, ver: payload.ver ?? 0 };
}
export function createNotificationsHandler(
  env: Env,
  transport: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  const db = async <T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    const response = await transport(`${env.supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
        Prefer: "return=representation",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        code?: string;
      };
      throw new Error(
        error.code === "P0002" ? "test cooldown" : "database unavailable",
      );
    }
    return (await response.json()) as T;
  };
  const rpc = <T>(name: string, body: unknown) =>
    db<T>("rpc/" + name, "POST", body);
  const results = (rows: Result[]) =>
    rpc("lapse_push_results", { p_rows: rows });
  const deliver = async (claims: Claim[]) => {
    const pending = claims.filter((c) => c.token && !c.replayed);
    if (!pending.length) return [];
    let statuses: Result[] = pending.map((c) => ({
      id: c.id,
      deviceId: c.deviceId,
      state: "unknown",
    }));
    try {
      const response = await transport("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.expoAccessToken
            ? { Authorization: `Bearer ${env.expoAccessToken}` }
            : {}),
        },
        body: JSON.stringify(
          pending.map((c) => ({
            to: c.token,
            title: c.title,
            body: c.body,
            channelId: "renewals",
            sound: "default",
            data: {
              lapse: true,
              test: !!c.test,
              reminderId: c.id,
              itemId: c.itemId,
            },
          })),
        ),
        signal: AbortSignal.timeout(8000),
      });
      const data = (await response.json()) as {
        data?: { status: string; id?: string; details?: { error?: string } }[];
      };
      statuses = pending.map((c, i) => {
        const ticket = data.data?.[i];
        return {
          id: c.id,
          deviceId: c.deviceId,
          state:
            ticket?.status === "ok"
              ? "accepted"
              : !c.test &&
                  (response.status === 429 ||
                    ticket?.details?.error === "MessageRateExceeded")
                ? "retry"
                : ticket?.status === "error"
                  ? "failed"
                  : "unknown",
          ticket: ticket?.id,
          invalidToken: ticket?.details?.error === "DeviceNotRegistered",
        };
      });
    } catch {
      /* Unknown acceptance is never automatically resent. Persistent claims remain. */
    }
    await results(statuses);
    return statuses;
  };
  const receipts = async () => {
    const stale = await db<{ reminder_id: string; device_id: string }[]>(
      `notification_attempts?state=eq.claimed&updated_at=lt.${encodeURIComponent(new Date(Date.now() - 120000).toISOString())}&select=reminder_id,device_id&limit=100`,
    );
    if (stale.length)
      await results(
        stale.map((r) => ({
          id: r.reminder_id,
          deviceId: r.device_id,
          state: "unknown",
        })),
      );
    const before = new Date(Date.now() - 15 * 60000).toISOString();
    const rows = await db<
      {
        reminder_id: string;
        device_id: string;
        ticket: string;
        updated_at: string;
      }[]
    >(
      `notification_attempts?state=eq.accepted&updated_at=lt.${encodeURIComponent(before)}&select=reminder_id,device_id,ticket,updated_at&order=updated_at.asc&limit=100`,
    );
    const expired = rows.filter(
      (r) => Date.parse(r.updated_at) < Date.now() - 24 * 3600000,
    );
    if (expired.length)
      await results(
        expired.map((r) => ({
          id: r.reminder_id,
          deviceId: r.device_id,
          state: "receipt_unknown",
        })),
      );
    const pending = rows.filter((r) => !expired.includes(r));
    if (!pending.length) return;
    try {
      const response = await transport(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.expoAccessToken
              ? { Authorization: `Bearer ${env.expoAccessToken}` }
              : {}),
          },
          body: JSON.stringify({ ids: pending.map((r) => r.ticket) }),
          signal: AbortSignal.timeout(6000),
        },
      );
      const { data } = (await response.json()) as {
        data?: Record<string, { status: string; details?: { error?: string } }>;
      };
      const known = pending.filter((r) => data?.[r.ticket]);
      if (known.length)
        await results(
          known.map((r) => ({
            id: r.reminder_id,
            deviceId: r.device_id,
            state: data![r.ticket].status === "ok" ? "receipt_ok" : "failed",
            invalidToken:
              data![r.ticket].details?.error === "DeviceNotRegistered",
          })),
        );
    } catch {
      /* Retry receipt polling on a future authorized run, not provider sends. */
    }
  };
  return async (request: Request): Promise<Response> => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization,apikey,content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (status: number, body: unknown) =>
      Response.json(body, {
        status,
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")
      return reply(405, { message: "POST required" });
    if (
      !env.supabaseUrl.startsWith("https://") ||
      !env.serviceKey ||
      !env.jwtSecret
    )
      return reply(503, { message: "Remote notifications are not configured" });
    let body: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (raw.length > 4096)
        return reply(413, { message: "Request too large" });
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
    } catch {
      return reply(400, { message: "Invalid request" });
    }
    const authorization = request.headers.get("authorization") ?? "";
    if (body.action === "dispatch") {
      if (!env.cronSecret || authorization !== `Bearer ${env.cronSecret}`)
        return reply(401, { message: "Unauthorized" });
      if (!env.scheduledEnabled)
        return reply(409, {
          message:
            "Scheduled dispatch is disabled until physical-device verification",
        });
      try {
        await receipts();
        let pages = 0,
          sent = 0;
        const deadline = Date.now() + 18000;
        while (pages < 10 && Date.now() < deadline) {
          const batch = await rpc<Batch | null>("lapse_push_batch", {});
          if (!batch) break;
          const pref = batch.preferences;
          const rows: Record<string, unknown>[] = [];
          let cursor = pref.item_cursor,
            stopped = false;
          for (const item of batch.items) {
            const override = batch.overrides.find(
              (o) => o.item_id === item.id,
            ) ?? { mode: "INHERIT", offsets: [] };
            const plan = deliveryPlan(
              [item],
              {
                ...pref,
                enabled: pref.enabled && override.mode !== "DISABLED",
                offsets:
                  override.mode === "OVERRIDE"
                    ? override.offsets
                    : pref.offsets,
              },
              now(),
            );
            if (rows.length + plan.length * batch.devices.length > 100) {
              stopped = true;
              break;
            }
            for (const event of plan)
              for (const device of batch.devices)
                rows.push({
                  kind: "reminder",
                  userId: pref.user_id,
                  deviceId: device.id,
                  itemId: item.id,
                  occurrence: event.occurrence,
                  offset: event.offset,
                  title:
                    event.name +
                    (event.offset === 0 ? " is due today" : " is coming up"),
                  body: "Due " + event.occurrence,
                  itemSnapshot: item,
                  preferenceSnapshot: {
                    enabled: pref.enabled,
                    offsets: pref.offsets,
                    hour: pref.hour,
                    timezone: pref.timezone,
                  },
                  overrideSnapshot: {
                    mode: override.mode,
                    offsets: override.offsets,
                  },
                });
            cursor = item.id;
          }
          if (rows.length) {
            const claims = await rpc<Claim[]>("lapse_push_claim", {
              p_rows: rows,
            });
            sent += (await deliver(claims)).length;
          }
          await rpc("lapse_push_finish", {
            p_user: pref.user_id,
            p_lease: batch.lease,
            p_cursor: cursor,
            p_more: stopped || batch.items.length === 10,
          });
          pages++;
        }
        return reply(200, { pages, submitted: sent });
      } catch {
        return reply(503, {
          message:
            "Notification worker could not complete; existing claims are retained",
        });
      }
    }
    if (!authorization.startsWith("Bearer "))
      return reply(401, { message: "Sign in again to manage notifications" });
    let user: { sub: string; ver: number };
    try {
      user = await verifyJwt(
        authorization.replace(/^Bearer /, ""),
        env.jwtSecret,
      );
    } catch {
      return reply(401, { message: "Sign in again to manage notifications" });
    }
    try {
      const accounts = await db<{ id: string; token_version: number }[]>(
        `master_users?id=eq.${user.sub}&is_active=eq.true&select=id,token_version&limit=1`,
      );
      if (accounts[0]?.token_version !== user.ver)
        return reply(401, { message: "Sign in again to manage notifications" });
      const deviceId = String(body.deviceId ?? "");
      if (body.action === "register") {
        if (
          !uuid.test(deviceId) ||
          typeof body.enabled !== "boolean" ||
          typeof body.token !== "string" ||
          !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(
            body.token,
          )
        )
          return reply(400, { message: "Invalid device registration" });
        let pref: DeliveryPreferences;
        try {
          pref = preferences(body.preferences);
        } catch {
          return reply(400, { message: "Invalid notification preferences" });
        }
        await rpc("lapse_push_register", {
          p_user: user.sub,
          p_device: deviceId,
          p_token: body.token,
          p_enabled: body.enabled,
          p_preferences: pref,
          p_version: user.ver,
        });
        return reply(200, {
          registered: true,
          configured: !!env.scheduledEnabled,
        });
      }
      if (body.action === "unregister") {
        if (!uuid.test(deviceId))
          return reply(400, { message: "Invalid device" });
        await db(
          `notification_devices?id=eq.${deviceId}&user_id=eq.${user.sub}`,
          "PATCH",
          { enabled: false },
        );
        return reply(200, { deleted: true });
      }
      if (body.action === "preferences") {
        const rows = await db<DeliveryPreferences[]>(
          `notification_preferences?user_id=eq.${user.sub}&limit=1`,
        );
        return reply(200, {
          configured: !!env.scheduledEnabled,
          initialized: !!rows[0],
          ...(rows[0] ?? {
            enabled: true,
            offsets: [7, 1, 0],
            hour: 9,
            timezone: "UTC",
          }),
        });
      }
      if (body.action === "save-preferences") {
        let pref: DeliveryPreferences;
        try {
          pref = preferences(body.preferences);
        } catch {
          return reply(400, { message: "Invalid notification preferences" });
        }
        await db(`notification_preferences?user_id=eq.${user.sub}`, "PATCH", {
          ...pref,
          item_cursor: null,
          next_check_at: new Date().toISOString(),
        });
        return reply(200, { saved: true });
      }
      if (body.action === "inbox") {
        const data = await db<{ read_at: string | null }[]>(
          `notification_inbox?user_id=eq.${user.sub}&order=created_at.desc&limit=200`,
        );
        return reply(200, {
          data,
          unread: data.filter((r) => !r.read_at).length,
        });
      }
      if (body.action === "read") {
        const id = body.id;
        if (
          id !== undefined &&
          (typeof id !== "string" ||
            !id.startsWith(user.sub + ":") ||
            id.length > 255)
        )
          return reply(400, { message: "Invalid notification" });
        await db(
          `notification_inbox?user_id=eq.${user.sub}&read_at=is.null${id ? "&id=eq." + encodeURIComponent(String(id)) : ""}`,
          "PATCH",
          { read_at: new Date().toISOString() },
        );
        return reply(200, { read: true });
      }
      if (
        body.action !== "test" ||
        !uuid.test(deviceId) ||
        !uuid.test(String(body.requestId ?? ""))
      )
        return reply(400, { message: "Invalid notification action" });
      const devices = await db<{ id: string }[]>(
        `notification_devices?id=eq.${deviceId}&user_id=eq.${user.sub}&enabled=eq.true&token_version=eq.${user.ver}&select=id&limit=1`,
      );
      if (!devices.length)
        return reply(404, {
          message: "Register this device before sending a test push",
        });
      const claims = await rpc<Claim[]>("lapse_push_claim", {
        p_rows: [
          {
            kind: "test",
            userId: user.sub,
            userVersion: user.ver,
            deviceId,
            requestId: body.requestId,
            title: "lapse. test notification",
            body: "Remote push reached your Android device.",
          },
        ],
      });
      if (claims[0]?.replayed)
        return reply(200, {
          state: claims[0].state,
          replayed: true,
          message: "This request was already processed and will not be resent",
        });
      const statuses = await deliver(claims);
      const state = statuses[0]?.state ?? "unknown";
      return reply(state === "failed" ? 502 : 200, {
        state,
        message:
          state === "accepted"
            ? "Expo accepted the test push. Check your Android device; acceptance does not confirm receipt."
            : state === "failed"
              ? "The push provider rejected the test. Check registration and FCM credentials."
              : "The send result is unknown. Check the device before submitting a new test.",
      });
    } catch (error) {
      return reply(
        error instanceof Error && error.message === "test cooldown" ? 429 : 503,
        {
          message:
            error instanceof Error && error.message === "test cooldown"
              ? "Wait 60 seconds before another test"
              : "Remote notifications are temporarily unavailable. Check Edge secrets and notification migrations.",
        },
      );
    }
  };
}
