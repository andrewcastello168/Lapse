import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthSession } from "@/types/models";
const sessionKey = "lapse.auth.session";
let writes: Promise<void> = Promise.resolve();
function ordered(work: () => Promise<void>): Promise<void> {
  writes = writes.catch(() => {}).then(work);
  return writes;
}
export async function readSession(): Promise<AuthSession | null> {
  try {
    await writes.catch(() => {});
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(sessionKey)
        : await SecureStore.getItemAsync(sessionKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof value.accessToken !== "string" ||
      typeof value.refreshToken !== "string" ||
      typeof value.user?.id !== "string" ||
      typeof value.user.name !== "string" ||
      typeof value.user.email !== "string"
    )
      return null;
    return value as AuthSession;
  } catch {
    return null;
  }
}
export function writeSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);
  return ordered(async () => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(sessionKey, raw);
      return;
    }
    await SecureStore.setItemAsync(sessionKey, raw);
  });
}
export function clearSession(): Promise<void> {
  return ordered(async () => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(sessionKey);
      return;
    }
    await SecureStore.deleteItemAsync(sessionKey);
  });
}
