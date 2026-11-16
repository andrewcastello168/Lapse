import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import type { Reminder } from "@/types/models";
import { reminderDiff, reminderFingerprint } from "./reminder-diff";
export type InboxEntry = {
  id: string;
  itemId: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
};
const storageKey = (userId: string) => "lapse.inbox." + userId;
export async function readInbox(userId: string): Promise<InboxEntry[]> {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(storageKey(userId))
        : await SecureStore.getItemAsync(storageKey(userId));
    return raw ? (JSON.parse(raw) as InboxEntry[]) : [];
  } catch {
    return [];
  }
}
export async function writeInbox(userId: string, entries: InboxEntry[]) {
  const raw = JSON.stringify(entries.slice(0, 200));
  if (Platform.OS === "web")
    globalThis.localStorage?.setItem(storageKey(userId), raw);
  else await SecureStore.setItemAsync(storageKey(userId), raw);
}
export async function permission(request = false) {
  if (Platform.OS === "web") return "unsupported" as const;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("renewals", {
      name: "Expiration reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#007E58",
    });
  let result = await Notifications.getPermissionsAsync();
  if (request && result.canAskAgain && !result.granted)
    result = await Notifications.requestPermissionsAsync();
  return result.granted
    ? ("granted" as const)
    : result.canAskAgain
      ? ("undetermined" as const)
      : ("denied" as const);
}
let queue: Promise<unknown> = Promise.resolve();
export function cancelItemReminders(itemId: string) {
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (Platform.OS === "web") return;
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of pending) {
        if (
          notification.identifier.startsWith("lapse:") &&
          notification.content.data?.itemId === itemId
        )
          await Notifications.cancelScheduledNotificationAsync(
            notification.identifier,
          );
      }
    });
  queue = task;
  return task;
}
export function reconcileReminders(
  reminders: Reminder[],
  delivered: string[] = [],
) {
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (Platform.OS === "web") return;
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      const diff = reminderDiff(
        pending.map((row) => ({
          id: row.identifier,
          fingerprint:
            typeof row.content.data?.fingerprint === "string"
              ? row.content.data.fingerprint
              : undefined,
        })),
        reminders,
        delivered,
      );
      for (const id of diff.cancel)
        await Notifications.cancelScheduledNotificationAsync(id);
      for (const row of diff.schedule) {
        await Notifications.scheduleNotificationAsync({
          identifier: "lapse:" + row.id,
          content: {
            title: row.itemName + " is coming up",
            body:
              "Due " + row.occurrenceDate + " · " + row.offset + " days to go",
            sound: "default",
            data: {
              lapse: true,
              reminderId: row.id,
              itemId: row.itemId,
              scheduledAt: row.scheduledAt,
              fingerprint: reminderFingerprint(row),
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(row.scheduledAt),
            channelId: "renewals",
          },
        });
      }
    });
  queue = task;
  return task;
}
export function inboxEntry(
  notification: Notifications.Notification,
): InboxEntry | null {
  const data = notification.request.content.data;
  if (
    !data?.lapse ||
    typeof data.reminderId !== "string" ||
    typeof data.itemId !== "string"
  )
    return null;
  return {
    id: data.reminderId,
    itemId: data.itemId,
    title: notification.request.content.title ?? "Expiration reminder",
    body: notification.request.content.body ?? "",
    date: new Date(notification.date).toISOString(),
    read: false,
  };
}
export { Notifications };
