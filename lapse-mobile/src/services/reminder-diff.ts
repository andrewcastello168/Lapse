import type { Reminder } from "../types/models";
export type PendingReminder = { id: string; fingerprint?: string };
export const reminderFingerprint = (reminder: Reminder) =>
  JSON.stringify([reminder.itemName, reminder.scheduledAt]);
export function reminderDiff(
  current: PendingReminder[],
  desired: Reminder[],
  delivered: string[] = [],
) {
  const wanted = new Map(
    desired
      .filter((row) => !delivered.includes(row.id))
      .map((row) => ["lapse:" + row.id, row]),
  );
  const kept = new Set(
    current
      .filter(
        (row) =>
          wanted.has(row.id) &&
          row.fingerprint === reminderFingerprint(wanted.get(row.id)!),
      )
      .map((row) => row.id),
  );
  return {
    cancel: current
      .filter((row) => row.id.startsWith("lapse:") && !kept.has(row.id))
      .map((row) => row.id),
    schedule: [...wanted.entries()]
      .filter(([id]) => !kept.has(id))
      .map(([, row]) => row),
  };
}
