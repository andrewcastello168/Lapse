// Presentation and form/calendar validation only. All expiration, recurrence,
// status and reminder calculations are owned by the API.
export type Interval = { years: number; months: number; days: number };
export function dateInZone(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function dateOnly(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateOnly(date) === value
    ? date
    : null;
}
export function formatDate(value?: string | null): string {
  const date = value ? parseDate(value.slice(0, 10)) : null;
  return date
    ? date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
}
export function intervalLabel(interval: Interval) {
  return (["years", "months", "days"] as const)
    .filter((unit) => interval[unit] > 0)
    .map(
      (unit) =>
        `${interval[unit]} ${interval[unit] === 1 ? unit.slice(0, -1) : unit}`,
    )
    .join(", ");
}
