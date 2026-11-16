import { describe, it, expect } from 'vitest';
import {
  addDays,
  derived,
  firstIndex,
  occurrence,
  parseDate,
  todayInZone,
  zonedInstant,
  type Schedule,
} from './calendar.js';
const recurring = (overrides: Partial<Schedule> = {}): Schedule => ({
  expiry_type: 'RECURRING',
  expiry_date: '2026-11-07',
  recurrence_years: 1,
  recurrence_months: 0,
  recurrence_days: 0,
  renewal_mode: 'AUTOMATIC',
  renewed_through: null,
  ...overrides,
});
describe('approved anchored calendar policy', () => {
  it('restores month-end and leap-day anchors', () => {
    expect(occurrence('2027-01-31', { years: 0, months: 1, days: 0 }, 1)).toBe(
      '2027-02-28',
    );
    expect(occurrence('2027-01-31', { years: 0, months: 1, days: 0 }, 2)).toBe(
      '2027-03-31',
    );
    expect(occurrence('2024-02-29', { years: 1, months: 0, days: 0 }, 4)).toBe(
      '2028-02-29',
    );
  });
  it('combines years and months before clamping then adds multiplied days', () => {
    expect(occurrence('2024-02-29', { years: 1, months: 1, days: 1 }, 1)).toBe(
      '2025-03-30',
    );
    expect(occurrence('2026-07-07', { years: 1, months: 1, days: 2 }, 1)).toBe(
      '2027-08-09',
    );
    expect(occurrence('2026-07-07', { years: 1, months: 1, days: 2 }, 2)).toBe(
      '2028-09-11',
    );
  });
  it('includes due today and handles dates before the anchor and missed periods', () => {
    expect(
      firstIndex('2026-11-07', { years: 1, months: 0, days: 0 }, '2026-11-07'),
    ).toBe(0);
    expect(
      firstIndex('2026-11-07', { years: 1, months: 0, days: 0 }, '2026-01-01'),
    ).toBe(0);
    expect(
      firstIndex('2000-01-01', { years: 0, months: 0, days: 1 }, '2026-11-14'),
    ).toBe(9814);
    expect(
      derived(recurring(), 'Asia/Jakarta', new Date('2026-11-07T01:00:00Z'))
        .expiration_status,
    ).toBe('DUE_TODAY');
  });
  it('keeps manual validity overdue and does not silently skip missed periods', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const manual = recurring({ renewal_mode: 'MANUAL' });
    expect(derived(manual, 'Asia/Jakarta', now)).toMatchObject({
      effective_expiry_date: '2026-11-07',
      days_remaining: -7,
      expiration_status: 'OVERDUE',
      next_scheduled_date: '2027-11-07',
      can_renew: true,
    });
    expect(
      derived(
        { ...manual, expiry_date: '2024-11-07', renewed_through: '2025-11-07' },
        'UTC',
        now,
      ).expiration_status,
    ).toBe('OVERDUE');
  });
  it('preserves ONCE and excludes NEVER', () => {
    expect(
      derived(
        { expiry_type: 'ONCE', expiry_date: '2026-11-07' },
        'UTC',
        new Date('2026-11-14T00:00Z'),
      ).days_remaining,
    ).toBe(-7);
    expect(
      derived({ expiry_type: 'NEVER', expiry_date: null }, 'UTC'),
    ).toMatchObject({
      days_remaining: null,
      expiration_status: 'NO_EXPIRY',
      can_renew: false,
    });
  });
  it('uses the selected local day across UTC midnight and DST', () => {
    const now = new Date('2026-11-14T01:00:00Z');
    expect(todayInZone('America/Los_Angeles', now)).toBe('2026-11-13');
    expect(todayInZone('Asia/Bangkok', now)).toBe('2026-11-14');
    expect(zonedInstant('2026-03-07', 9, 'America/New_York')).toBe(
      '2026-03-07T14:00:00.000Z',
    );
    expect(zonedInstant('2026-03-08', 9, 'America/New_York')).toBe(
      '2026-03-08T13:00:00.000Z',
    );
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it.each(['2026-02-30', '2026-13-01', '2027-02-29', 'invalid'])(
    'rejects invalid calendar date %s',
    (value) => expect(() => parseDate(value)).toThrow(),
  );
  it('enforces recurrence component limits', () => {
    expect(() =>
      firstIndex('2026-01-01', { years: 0, months: 0, days: 0 }, '2026-02-01'),
    ).toThrow();
    expect(() =>
      firstIndex('2026-01-01', { years: -1, months: 1, days: 0 }, '2026-02-01'),
    ).toThrow();
  });
});
