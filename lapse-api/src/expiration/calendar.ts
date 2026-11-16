import { BadRequestException } from '@nestjs/common';

export type Interval = { years: number; months: number; days: number };
export type Schedule = {
  expiry_type: 'ONCE' | 'RECURRING' | 'NEVER';
  expiry_date: string | null;
  recurrence_years?: number | null;
  recurrence_months?: number | null;
  recurrence_days?: number | null;
  renewal_mode?: 'AUTOMATIC' | 'MANUAL' | null;
  renewed_through?: string | null;
};
export function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException(
      'Use a valid calendar date in YYYY-MM-DD format',
    );
  return date;
}
export function dateOnly(date: Date): string {
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() > 9999 ||
    date.getUTCFullYear() < 1
  )
    throw new BadRequestException(
      'The schedule exceeds supported calendar dates',
    );
  return date.toISOString().slice(0, 10);
}
export function timezone(value = 'UTC'): string {
  if (!/^(?:UTC|GMT|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value))
    throw new BadRequestException('Choose a valid IANA timezone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    throw new BadRequestException('Choose a valid IANA timezone');
  }
  return value;
}
export function todayInZone(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone(zone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}
export function occurrence(
  anchor: string,
  interval: Interval,
  index: number,
): string {
  const date = parseDate(anchor);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(
    date.getUTCMonth() + index * (interval.years * 12 + interval.months),
  );
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  date.setUTCDate(Math.min(originalDay, last.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + index * interval.days);
  return dateOnly(date);
}
export function intervalOf(item: Schedule): Interval {
  return {
    years: item.recurrence_years ?? 0,
    months: item.recurrence_months ?? 0,
    days: item.recurrence_days ?? 0,
  };
}
export function firstIndex(
  anchor: string,
  interval: Interval,
  from: string,
): number {
  parseDate(from);
  if (
    !Object.values(interval).every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 999,
    ) ||
    !Object.values(interval).some((n) => n > 0)
  )
    throw new BadRequestException(
      'Recurrence components must be 0–999 with at least one positive component',
    );
  if (anchor >= from) return 0;
  // Exponential search avoids walking every missed daily period. An overflow is
  // greater than every supported date and can safely bound the binary search.
  const atOrAfter = (n: number) => {
    try {
      return occurrence(anchor, interval, n) >= from;
    } catch {
      return true;
    }
  };
  let high = 1;
  while (!atOrAfter(high)) high *= 2;
  let low = 0;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (atOrAfter(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}
export function nextOccurrence(
  item: Schedule,
  from: string,
  strictlyAfter = false,
): string | null {
  if (!item.expiry_date || item.expiry_type === 'NEVER') return null;
  if (item.expiry_type === 'ONCE') return item.expiry_date;
  const interval = intervalOf(item);
  try {
    const index = firstIndex(item.expiry_date, interval, from);
    const date = occurrence(item.expiry_date, interval, index);
    return strictlyAfter && date === from
      ? occurrence(item.expiry_date, interval, index + 1)
      : date;
  } catch (error) {
    if (
      error instanceof BadRequestException &&
      error.message.includes('exceeds')
    )
      return null;
    throw error;
  }
}
export function derived(item: Schedule, zone: string, now = new Date()) {
  const today = todayInZone(zone, now);
  const manual =
    item.expiry_type === 'RECURRING' && item.renewal_mode === 'MANUAL';
  const effective =
    item.expiry_type === 'NEVER'
      ? null
      : manual
        ? (item.renewed_through ?? item.expiry_date)
        : nextOccurrence(item, today);
  const days = effective
    ? Math.round(
        (parseDate(effective).getTime() - parseDate(today).getTime()) /
          86400000,
      )
    : null;
  return {
    effective_expiry_date: effective,
    next_scheduled_date:
      manual && effective
        ? nextOccurrence(item, effective, true)
        : nextOccurrence(item, today),
    days_remaining: days,
    expiration_status:
      days === null
        ? 'NO_EXPIRY'
        : days < 0
          ? 'OVERDUE'
          : days === 0
            ? 'DUE_TODAY'
            : days <= 7
              ? 'EXPIRING_SOON'
              : 'UPCOMING',
    can_renew: item.expiry_type === 'ONCE' || manual,
  };
}
// Convert a wall-clock reminder to an instant without assuming a fixed UTC
// offset. Two passes account for offsets on the target date (including DST).
export function zonedInstant(
  value: string,
  hour: number,
  zone: string,
): string {
  const desired = parseDate(value).getTime() + hour * 3600000;
  let timestamp = desired;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone(zone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const p = (name: string) =>
      Number(parts.find((x) => x.type === name)!.value);
    const wall = Date.UTC(
      p('year'),
      p('month') - 1,
      p('day'),
      p('hour'),
      p('minute'),
      p('second'),
    );
    timestamp += desired - wall;
  }
  return new Date(timestamp).toISOString();
}
