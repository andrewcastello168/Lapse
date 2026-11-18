import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { isDevice } from "expo-device";
import { api, getSession, notificationRequest, ApiError } from "./api";
import { readLocal, writeLocal, bounded } from "@/utils/local";
import { Notifications } from "./notifications";
export async function installationId() {
  let id = await readLocal("lapse.installation");
  if (!id) {
    id = Crypto.randomUUID();
    await writeLocal("lapse.installation", id);
  }
  return id;
}
export async function registerPush(
  enabled: boolean,
  preferences = {
    enabled: true,
    offsets: [7, 1, 0],
    hour: 9,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  },
) {
  if (!enabled) {
    await unregisterPush();
    return true;
  }
  if (
    Platform.OS === "web" ||
    !isDevice ||
    Constants.executionEnvironment === "storeClient"
  )
    return false;
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return false;
  const expectedUser = getSession()?.user.id;
  const token = await bounded(
    Notifications.getExpoPushTokenAsync({ projectId }),
    null,
    10000,
  );
  if (!token)
    throw new Error(
      "Unable to register for push notifications. Check connectivity and the native build.",
    );
  if (getSession()?.user.id !== expectedUser) return false;
  const result = await api.registerDevice({
    id: await installationId(),
    token: token.data,
    enabled,
    preferences,
  });
  return result.registered;
}
export async function unregisterPush() {
  const id = await readLocal("lapse.installation");
  if (id) await api.removeDevice(id);
}

export async function sendTestPush() {
  if (
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient" ||
    !isDevice
  )
    throw new Error(
      "Remote push testing requires an Android development build on a physical device. Expo Go remains available for UI development.",
    );
  const { permission } = await import("./notifications");
  if ((await permission(true)) !== "granted")
    throw new Error(
      "Allow notifications in Android settings before sending a test push.",
    );
  if (!(await registerPush(true)))
    throw new Error(
      "Push registration is unavailable. Check the API and EAS project configuration.",
    );
  const origin = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  if (!origin.startsWith("https://"))
    throw new Error("Remote push test endpoint is not configured.");
  try {
    return await notificationRequest<{ message?: string; state?: string }>(
      "test",
      {
        deviceId: await installationId(),
        requestId: Crypto.randomUUID(),
      },
      25000,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 0)
      throw new Error(
        "The test result is unknown. Check your device before trying again.",
      );
    throw error;
  }
}
