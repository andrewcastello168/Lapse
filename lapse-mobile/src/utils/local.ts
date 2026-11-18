import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export async function readLocal(key: string) {
  return Platform.OS === "web"
    ? (globalThis.localStorage?.getItem(key) ?? null)
    : SecureStore.getItemAsync(key);
}
export async function writeLocal(key: string, value: string) {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function bounded<T>(
  work: Promise<T>,
  fallback: T,
  ms = 1500,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
