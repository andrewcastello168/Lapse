import { describe, it, expect } from 'vitest';
import { deliveryPlan } from './notification-plan.js';
import type { UserItemRow } from '../expiration/models.js';
const item: UserItemRow = {
  id: 'item',
  user_id: 'user',
  mi_id: null,
  mc_id: 1,
  item_name: 'Daily',
  expiry_type: 'RECURRING',
  expiry_date: '2026-01-31',
  recurrence_years: 0,
  recurrence_months: 0,
  recurrence_days: 1,
  renewal_mode: 'AUTOMATIC',
  renewed_through: null,
};
const prefs = {
  enabled: true,
  offsets: [7, 1, 0],
  hour: 9,
  timezone: 'Asia/Kathmandu',
};
describe('server reminder planning', () => {
  it('covers future occurrences when offset exceeds interval and fractional zones', () => {
    const rows = deliveryPlan(
      [item],
      prefs,
      Date.parse('2026-11-16T04:00:00Z'),
    );
    expect(rows.map((r) => r.occurrence)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-23',
    ]);
    expect(rows.every((r) => r.instant === '2026-11-16T03:15:00.000Z')).toBe(
      true,
    );
  });
  it('bounds missed-run recovery and never floods old manual dates', () => {
    expect(
      deliveryPlan([item], prefs, Date.parse('2026-11-16T06:00:00Z')),
    ).toHaveLength(0);
    expect(
      deliveryPlan(
        [{ ...item, renewal_mode: 'MANUAL' }],
        prefs,
        Date.parse('2026-11-16T04:00:00Z'),
      ),
    ).toHaveLength(0);
  });
  it('does not deliver for NEVER or disabled preferences', () => {
    expect(
      deliveryPlan(
        [{ ...item, expiry_type: 'NEVER', expiry_date: null }],
        prefs,
      ),
    ).toEqual([]);
    expect(deliveryPlan([item], { ...prefs, enabled: false })).toEqual([]);
  });
  it('keeps month-end anchors and observes DST', () => {
    const monthly = { ...item, recurrence_months: 1, recurrence_days: 0 };
    const rows = deliveryPlan(
      [monthly],
      { ...prefs, offsets: [0], timezone: 'America/New_York' },
      Date.parse('2026-02-28T14:30:00Z'),
    );
    expect(rows[0]?.occurrence).toBe('2026-02-28');
    expect(monthly.expiry_date).toBe('2026-01-31');
    const dst = deliveryPlan(
      [item],
      { ...prefs, offsets: [0], timezone: 'America/New_York' },
      Date.parse('2026-03-08T13:30:00Z'),
    );
    expect(dst[0]?.instant).toBe('2026-03-08T13:00:00.000Z');
  });
});
