import type {
  AuthSession,
  Category,
  MasterItem,
  Reminder,
  SessionUser,
  TimelinePage,
  UserItem,
  ItemInput,
} from "@/types/models";
import { clearSession, writeSession } from "@/utils/storage";
const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
let session: AuthSession | null = null;
let selectedTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
let generation = 0;
let refreshPromise: Promise<void> | null = null;
const listeners = new Set<(value: AuthSession | null) => void>();
const changes = new Set<(change: { itemId?: string }) => void>();
export const setApiTimezone = (value: string) => {
  selectedTimezone = value;
};
export const subscribeSession = (
  listener: (value: AuthSession | null) => void,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const subscribeItems = (
  listener: (change: { itemId?: string }) => void,
) => {
  changes.add(listener);
  return () => {
    changes.delete(listener);
  };
};
export function setSession(value: AuthSession | null) {
  if (
    value?.user.id !== session?.user.id ||
    value?.accessToken !== session?.accessToken ||
    value?.refreshToken !== session?.refreshToken
  )
    generation++;
  session = value;
  listeners.forEach((fn) => fn(value));
}
export const getSession = () => session;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function refresh() {
  if (refreshPromise) return refreshPromise;
  const current = session;
  const version = generation;
  if (!current) throw new ApiError("Sign in to continue", 401);
  refreshPromise = (async () => {
    try {
      const tokens = await request<{
        accessToken: string;
        refreshToken: string;
      }>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        },
        false,
      );
      if (generation !== version) return;
      session = { ...session!, ...tokens };
      await writeSession(session);
      listeners.forEach((fn) => fn(session));
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        generation === version
      ) {
        setSession(null);
        await clearSession();
      }
      throw error;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
  origin = baseUrl,
  timeoutMs = 8000,
): Promise<T> {
  if (!origin)
    throw new ApiError("Unable to connect to the server. Please try again.", 0);
  const token = session?.accessToken;
  const version = generation;
  const send = async () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(`${origin}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "X-Timezone": selectedTimezone,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...init.headers,
            },
          });
          // Keep response body reads inside the timeout too.
          const body: unknown = await response.json().catch(() => null);
          return {
            status: response.status,
            ok: response.ok,
            json: async () => body,
          };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new ApiError(
                "Unable to connect to the server. Please try again.",
                0,
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } catch {
      throw new ApiError(
        "Unable to connect to the server. Please try again.",
        0,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  // Retry a safe GET once. Never replay a credential, refresh or mutation POST
  // after an ambiguous transport failure; retrying login is an explicit user action.
  let response;
  try {
    response = await send();
  } catch (error) {
    if ((init.method ?? "GET") !== "GET" || generation !== version) throw error;
    response = await send();
  }

  if (
    response.status === 401 &&
    retry &&
    session?.refreshToken &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/signup")
  ) {
    if (generation !== version)
      throw new ApiError("Your session changed. Please try again", 401);
    if (session.accessToken === token) await refresh();
    return request<T>(path, init, false, origin, timeoutMs);
  }
  if (!response.ok) {
    const body = ((await response.json().catch(() => null)) ?? {}) as {
      message?: string | string[];
    };
    throw new ApiError(
      response.status >= 500
        ? path === "/auth/forgot-password"
          ? "Password reset email is unavailable right now. Please try again later."
          : "Service temporarily unavailable. Please try again later"
        : Array.isArray(body.message)
          ? body.message.join(", ")
          : (body.message ?? "Request failed"),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
async function mutation<T>(path: string, method: string, body?: unknown) {
  const result = await request<T>(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const itemId = path.split("/")[2] ?? (result as { id?: string })?.id;
  changes.forEach((fn) => fn({ itemId }));
  return result;
}
const edgeOrigin = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(
  /\/$/,
  "",
);
export const notificationRequest = <T>(
  action: string,
  body: Record<string, unknown> = {},
  timeoutMs = 8000,
) =>
  request<T>(
    "/functions/v1/notifications",
    { method: "POST", body: JSON.stringify({ action, ...body }) },
    true,
    edgeOrigin,
    timeoutMs,
  );
let preferenceWrite: Promise<unknown> = Promise.resolve();
function saveNotificationPreferences(body: {
  enabled: boolean;
  offsets: number[];
  hour: number;
  timezone: string;
}) {
  const owner = session?.user.id;
  const snapshot = { ...body, offsets: [...body.offsets] };
  const next = preferenceWrite
    .catch(() => {})
    .then(() => {
      if (!owner || session?.user.id !== owner)
        throw new ApiError("Your session changed. Please try again", 401);
      return notificationRequest("save-preferences", { preferences: snapshot });
    });
  preferenceWrite = next;
  return next;
}
export const api = {
  notificationPreferences: () =>
    notificationRequest<{
      configured: boolean;
      initialized: boolean;
      enabled: boolean;
      offsets: number[];
      hour: number;
      timezone: string;
    }>("preferences"),
  saveNotificationPreferences,
  registerDevice: (body: {
    id: string;
    token: string;
    enabled: boolean;
    preferences: {
      enabled: boolean;
      offsets: number[];
      hour: number;
      timezone: string;
    };
  }) =>
    notificationRequest<{ registered: boolean; configured: boolean }>(
      "register",
      {
        deviceId: body.id,
        token: body.token,
        enabled: body.enabled,
        preferences: body.preferences,
      },
    ),
  removeDevice: (id: string) =>
    notificationRequest("unregister", { deviceId: id }),
  notificationInbox: () =>
    notificationRequest<{
      unread: number;
      data: {
        id: string;
        item_id: string | null;
        title: string;
        body: string;
        created_at: string;
        read_at: string | null;
      }[];
    }>("inbox"),
  readNotification: (id?: string) =>
    notificationRequest("read", id ? { id } : {}),
  itemNotificationPreferences: (id: string) =>
    request<{ mode: string; offsets: number[] }>(`/notifications/items/${id}`),
  saveItemNotificationPreferences: (
    id: string,
    body: { mode: string; offsets: number[] },
  ) =>
    request(`/notifications/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ mode: body.mode, offsets: body.offsets }),
    }),
  signup: (body: { name: string; email: string; password: string }) =>
    request<{ message: string; user: SessionUser }>(
      "/auth/signup",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ),
  login: (body: { email: string; password: string }) =>
    request<AuthSession>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ),
  logout: () =>
    session
      ? request(
          "/auth/logout",
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: session.refreshToken }),
          },
          false,
        )
      : Promise.resolve(),
  forgotPassword: (email: string) =>
    request<{ message: string }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
      baseUrl,
      30000,
    ),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, password }) },
      false,
    ),
  me: () => request<SessionUser>("/auth/me"),
  profile: (body: { name?: string; timezone?: string }) =>
    request<SessionUser>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  categories: () => request<Category[]>("/categories"),
  items: (categoryId?: number | string, search?: string) =>
    request<MasterItem[]>(
      `/items?${new URLSearchParams({ ...(categoryId ? { categoryId: String(categoryId) } : {}), ...(search ? { search } : {}) })}`,
    ),
  userItems: (timezone?: string) =>
    request<UserItem[]>("/user-items", {
      headers: timezone ? { "X-Timezone": timezone } : {},
    }),
  preview: (body: Partial<ItemInput>, timezone?: string) =>
    request<
      Pick<
        UserItem,
        | "effective_expiry_date"
        | "next_scheduled_date"
        | "days_remaining"
        | "expiration_status"
        | "can_renew"
      >
    >("/user-items/preview", {
      method: "POST",
      body: JSON.stringify(body),
      headers: timezone ? { "X-Timezone": timezone } : {},
    }),
  userItem: (id: string, timezone?: string) =>
    request<UserItem>(`/user-items/${encodeURIComponent(id)}`, {
      headers: timezone ? { "X-Timezone": timezone } : {},
    }),
  createItem: (body: ItemInput) =>
    mutation<UserItem>("/user-items", "POST", body),
  updateItem: (id: string, body: Partial<ItemInput>) =>
    mutation<UserItem>(`/user-items/${encodeURIComponent(id)}`, "PATCH", body),
  deleteItem: (id: string) =>
    mutation<{ deleted: boolean }>(
      `/user-items/${encodeURIComponent(id)}`,
      "DELETE",
    ),
  renew: (id: string, expected: string, newDate: string) =>
    mutation<UserItem>(`/user-items/${encodeURIComponent(id)}/renew`, "POST", {
      expected_expiry_date: expected,
      new_expiry_date: newDate,
    }),
  timeline: async (
    from?: string,
    to?: string,
    window = "3M",
    timezone?: string,
  ) => {
    const query = new URLSearchParams(from && to ? { from, to } : { window });
    let page = await request<TimelinePage>(`/timeline?${query}`, {
      headers: timezone ? { "X-Timezone": timezone } : {},
    });
    const data = [...page.data];
    while (page.hasMore) {
      query.set("offset", String(data.length));
      page = await request<TimelinePage>(`/timeline?${query}`, {
        headers: timezone ? { "X-Timezone": timezone } : {},
      });
      data.push(...page.data);
    }
    return { ...page, offset: 0, data };
  },
  reminders: (offset: number, hour: number, timezone?: string) =>
    request<{ timezone: string; horizon: string; data: Reminder[] }>(
      `/reminders?offset=${offset}&hour=${hour}`,
      { headers: timezone ? { "X-Timezone": timezone } : {} },
    ),
};
