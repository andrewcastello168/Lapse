export type Interval = { years: number; months: number; days: number };

// API dates are local calendar dates, not UTC timestamps.
export function dateOnly(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00`);
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
export function daysUntil(value: string): number {
    const target = parseDate(value.slice(0, 10));
    const today = new Date();
    return target
        ? Math.round(
              (Date.UTC(
                  target.getFullYear(),
                  target.getMonth(),
                  target.getDate(),
              ) -
                  Date.UTC(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate(),
                  )) /
                  86400000,
          )
        : 0;
}
function addClampedMonths(date: Date, months: number): Date {
    const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const end = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0,
    ).getDate();
    result.setDate(Math.min(date.getDate(), end));
    return result;
}
// Matches the API's anchored recurrence: years, then months, then days.
export function nextDueDate(
    start: string,
    interval: Interval,
    from = dateOnly(),
): string | null {
    const anchor = parseDate(start);
    if (
        !anchor ||
        !parseDate(from) ||
        !Object.values(interval).every((v) => Number.isInteger(v) && v >= 0) ||
        !Object.values(interval).some((v) => v > 0)
    )
        return null;
    for (let n = 0; n < 100000; n++) {
        const yearDate = addClampedMonths(anchor, n * interval.years * 12);
        const date = addClampedMonths(yearDate, n * interval.months);
        date.setDate(date.getDate() + n * interval.days);
        if (dateOnly(date) >= from) return dateOnly(date);
    }
    return null;
}
