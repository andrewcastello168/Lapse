const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  path = require("node:path"),
  crypto = require("node:crypto").webcrypto;
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      load(path.resolve(path.dirname(file), name.replace(/\.js$/, ".ts"))),
    Response,
    Request,
    AbortSignal,
    fetch,
    crypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    atob,
    JSON,
  });
  return exports;
}
const { createNotificationsHandler: create, verifyJwt } = load(
  path.resolve(__dirname, "../../supabase/functions/notifications/handler.ts"),
);
const user = "6ee52d37-2bd4-4bba-b44e-656ebd6274d3",
  deviceId = "e237606a-f7f4-4f20-aa4a-1e68bc7321c3",
  requestId = "41a17043-a80e-4bd8-851e-be07353bfe60";
const env = {
  supabaseUrl: "https://project.example.test",
  serviceKey: "edge-only-service-key",
  jwtSecret: "existing-custom-auth-secret",
};
async function jwt(
  payload = { sub: user, ver: 0, exp: Date.now() / 1000 + 900 },
  secret = env.jwtSecret,
) {
  const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url"),
    body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(header + "." + body),
  );
  return (
    header + "." + body + "." + Buffer.from(signature).toString("base64url")
  );
}
async function request(body = { action: "test", deviceId, requestId }) {
  return new Request(
    "https://project.example.test/functions/v1/notifications",
    {
      method: "POST",
      headers: { authorization: "Bearer " + (await jwt()) },
      body: JSON.stringify(body),
    },
  );
}
const auth = (url) =>
  url.includes("/master_users?")
    ? Response.json([{ id: user, token_version: 0 }])
    : url.includes("/notification_devices?")
      ? Response.json([{ id: deviceId }])
      : null;
test("missing Edge secrets and database outages are service errors, not sign-in errors", async () => {
  const req = await request({ action: "preferences" });
  assert.equal((await create({ ...env, jwtSecret: "" })(req)).status, 503);
  const handler = create(env, async () =>
    Response.json({ code: "unavailable" }, { status: 503 }),
  );
  assert.equal(
    (await handler(await request({ action: "preferences" }))).status,
    503,
  );
});
test("preferences persist before device registration while scheduling remains disabled", async () => {
  let write;
  const handler = create(env, async (url, init) => {
    if (auth(url)) return auth(url);
    write = { url, ...init };
    return Response.json([]);
  });
  const value = {
    enabled: true,
    offsets: [0, 14],
    hour: 17,
    timezone: "Asia/Kathmandu",
  };
  assert.equal(
    (
      await handler(
        await request({ action: "save-preferences", preferences: value }),
      )
    ).status,
    200,
  );
  assert.equal(write.method, "POST");
  assert.ok(write.headers.Prefer.includes("resolution=merge-duplicates"));
  assert.equal(JSON.parse(write.body).user_id, user);
  assert.deepEqual(JSON.parse(write.body).offsets, [0, 14]);
  assert.equal(
    (await (await handler(await request({ action: "preferences" }))).json())
      .configured,
    false,
  );
});
test("device registration preserves verified owner/version and does not enable scheduling", async () => {
  let registered;
  const handler = create(env, async (url, init) => {
    if (url.includes("/master_users?")) return auth(url);
    assert.ok(url.includes("/rpc/lapse_push_register"));
    registered = JSON.parse(init.body);
    return Response.json(true);
  });
  const result = await handler(
    await request({
      action: "register",
      deviceId,
      token: "ExpoPushToken[owned]",
      enabled: true,
      preferences: {
        enabled: true,
        offsets: [7, 1, 0],
        hour: 9,
        timezone: "UTC",
      },
    }),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).configured, false);
  assert.equal(registered.p_user, user);
  assert.equal(registered.p_version, 0);
});
test("Edge verifies existing custom JWT signature, expiry and revocation before provider work", async () => {
  await assert.rejects(
    verifyJwt(await jwt(undefined, "wrong-secret"), env.jwtSecret),
  );
  await assert.rejects(
    verifyJwt(await jwt({ sub: user, ver: 0, exp: 1 }), env.jwtSecret),
  );
  let calls = 0;
  const handler = create(env, async () => {
    calls++;
    return Response.json([{ id: user, token_version: 1 }]);
  });
  assert.equal((await handler(await request())).status, 401);
  assert.equal(calls, 1);
  assert.equal(
    (
      await handler(
        new Request("https://example.test", { method: "POST", body: "null" }),
      )
    ).status,
    400,
  );
});
test("persisted replay claims never send another Expo request", async () => {
  let sends = 0;
  const handler = create(env, async (url) => {
    if (auth(url)) return auth(url);
    if (url.includes("exp.host")) sends++;
    return Response.json([
      { id: "claim", deviceId, state: "accepted", replayed: true },
    ]);
  });
  const response = await handler(await request());
  assert.equal((await response.json()).replayed, true);
  assert.equal(sends, 0);
});
test("Edge sends only the owned claimed token and records acceptance separately", async () => {
  let sent, recorded;
  const handler = create(env, async (url, init) => {
    if (auth(url)) return auth(url);
    if (url.includes("lapse_push_claim"))
      return Response.json([
        {
          id: user + ":test:" + requestId,
          deviceId,
          token: "ExpoPushToken[owned]",
          title: "Test",
          body: "Test",
          itemId: "",
          test: true,
        },
      ]);
    if (url.includes("exp.host")) {
      sent = JSON.parse(init.body);
      return Response.json({ data: [{ status: "ok", id: "ticket" }] });
    }
    recorded = JSON.parse(init.body);
    return Response.json(true);
  });
  const result = await handler(await request());
  assert.equal((await result.json()).state, "accepted");
  assert.equal(sent[0].to, "ExpoPushToken[owned]");
  assert.equal(sent[0].channelId, "renewals");
  assert.equal(recorded.p_rows[0].ticket, "ticket");
});
test("unknown provider acceptance is recorded once and never blindly resent", async () => {
  let sends = 0,
    recorded;
  const handler = create(env, async (url, init) => {
    if (auth(url)) return auth(url);
    if (url.includes("lapse_push_claim"))
      return Response.json([
        {
          id: "claim",
          deviceId,
          token: "ExpoPushToken[owned]",
          title: "Test",
          body: "Test",
          test: true,
        },
      ]);
    if (url.includes("exp.host")) {
      sends++;
      throw new Error("lost connection");
    }
    recorded = JSON.parse(init.body);
    return Response.json(true);
  });
  await handler(await request());
  assert.equal(sends, 1);
  assert.equal(recorded.p_rows[0].state, "unknown");
});
test("scheduling defaults off and requires a separate Cron secret", async () => {
  let calls = 0;
  const handler = create({ ...env, cronSecret: "cron-secret" }, async () => {
    calls++;
  });
  const response = await handler(
    new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer cron-secret" },
      body: JSON.stringify({ action: "dispatch" }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(calls, 0);
});
test("Edge worker runs with Node offline and derives a later occurrence from the unchanged anchor", async () => {
  const item = {
    id: deviceId,
    mi_id: null,
    mc_id: 1,
    item_name: "Monthly",
    expiry_type: "RECURRING",
    expiry_date: "2026-11-25",
    recurrence_years: 0,
    recurrence_months: 1,
    recurrence_days: 0,
    renewal_mode: "AUTOMATIC",
    renewed_through: null,
  };
  let batches = 0,
    claimed;
  const urls = [];
  const handler = create(
    { ...env, scheduledEnabled: true, cronSecret: "cron-secret" },
    async (url, init) => {
      urls.push(url);
      if (url.includes("/notification_attempts?")) return Response.json([]);
      if (url.includes("lapse_push_batch"))
        return Response.json(
          batches++
            ? null
            : {
                preferences: {
                  user_id: user,
                  enabled: true,
                  offsets: [0],
                  hour: 9,
                  timezone: "UTC",
                  item_cursor: null,
                },
                items: [item],
                devices: [{ id: deviceId }],
                overrides: [],
                lease: "lease",
              },
        );
      if (url.includes("lapse_push_claim")) {
        claimed = JSON.parse(init.body);
        return Response.json([]);
      }
      return Response.json(true);
    },
    () => Date.parse("2027-01-25T09:30:00Z"),
  );
  const response = await handler(
    new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer cron-secret" },
      body: JSON.stringify({ action: "dispatch" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(claimed.p_rows[0].occurrence, "2027-01-25");
  assert.equal(claimed.p_rows[0].itemSnapshot.expiry_date, "2026-11-25");
  assert.equal(item.expiry_date, "2026-11-25");
  assert.ok(
    urls.every(
      (url) =>
        url.startsWith(env.supabaseUrl) || url.startsWith("https://exp.host"),
    ),
  );
  assert.ok(!urls.some((url) => url.includes("/user_items")));
});
