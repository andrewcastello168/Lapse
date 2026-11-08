import type {
    AuthSession,
    Category,
    MasterItem,
    TimelineOccurrence,
    UserItem,
} from "@/types/models";
import { writeSession } from "@/utils/storage";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
let session: AuthSession | null = null;

export const setSession = (value: AuthSession | null) => {
    session = value;
};
export const getSession = () => session;

async function request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
): Promise<T> {
    if (!baseUrl) {
        throw new Error(
            "API is not configured. Set EXPO_PUBLIC_API_URL to connect Lapse.",
        );
    }

    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(session?.accessToken
                ? { Authorization: `Bearer ${session.accessToken}` }
                : {}),
            ...(init.headers ?? {}),
        },
    });

    if (response.status === 401 && retry && session?.refreshToken) {
        const refreshed = await request<{
            accessToken: string;
            refreshToken: string;
        }>(
            "/auth/refresh",
            {
                method: "POST",
                body: JSON.stringify({ refreshToken: session.refreshToken }),
            },
            false,
        );
        session = { ...session, ...refreshed };
        await writeSession(session);
        return request<T>(path, init, false);
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
            Array.isArray(body.message)
                ? body.message.join(", ")
                : (body.message ?? "Request failed"),
        );
    }

    return response.json() as Promise<T>;
}

export const api = {
    signup: (body: { name: string; email: string; password: string }) =>
        request<{
            message: string;
            user: { id: string; name: string; email: string };
        }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
        request<AuthSession>("/auth/login", {
            method: "POST",
            body: JSON.stringify(body),
        }),
    logout: () =>
        session
            ? request("/auth/logout", {
                  method: "POST",
                  body: JSON.stringify({ refreshToken: session.refreshToken }),
              })
            : Promise.resolve(),
    categories: () => request<Category[]>("/categories"),
    items: (categoryId?: number | string, search?: string) =>
        request<MasterItem[]>(
            `/items?${categoryId ? `categoryId=${categoryId}&` : ""}${
                search ? `search=${encodeURIComponent(search)}` : ""
            }`,
        ),
    createItem: (body: Record<string, unknown>) =>
        request<UserItem>("/user-items", {
            method: "POST",
            body: JSON.stringify(body),
        }),
    timeline: (from: string, to: string) =>
        request<{ data: TimelineOccurrence[] }>(
            `/timeline?from=${from}&to=${to}`,
        ),
};
