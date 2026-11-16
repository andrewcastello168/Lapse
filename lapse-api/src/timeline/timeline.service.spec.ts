import { describe, it, expect } from 'vitest';
import type { Knex } from 'knex';
import { eventsFor, TimelineService } from './timeline.service.js';
import type { UserItemRow } from '../expiration/models.js';
const base: UserItemRow = {
  id: 'one',
  user_id: 'owner',
  mi_id: null,
  mc_id: 1,
  item_name: 'Subscription',
  expiry_type: 'RECURRING',
  expiry_date: '2026-01-31',
  recurrence_years: 0,
  recurrence_months: 1,
  recurrence_days: 0,
  renewal_mode: 'AUTOMATIC',
  renewed_through: null,
};
describe('bounded occurrence queries', () => {
  it('includes all anchored automatic events and only actionable manual dates', () => {
    const manual = { ...base, id: 'manual', renewal_mode: 'MANUAL' as const };
    const events = eventsFor(
      [
        base,
        manual,
        { ...base, id: 'never', expiry_type: 'NEVER', expiry_date: null },
      ],
      '2026-01-01',
      '2026-03-31',
      'UTC',
    );
    expect(events.map((row) => row.occurrenceDate)).toEqual([
      '2026-01-31',
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(new Set(events.map((row) => row.userItemId)).size).toBe(2);
  });
  it('requires ordered ranges of at most one calendar year', () => {
    const service = new TimelineService({} as Knex);
    expect(() =>
      service.range(
        { from: '2026-01-01', to: '2027-01-02', limit: 500, offset: 0 },
        'UTC',
      ),
    ).toThrow('one calendar year');
    expect(() =>
      service.range(
        { from: '2026-02-01', to: '2026-01-01', limit: 500, offset: 0 },
        'UTC',
      ),
    ).toThrow();
    expect(
      service.range(
        { from: '2026-01-31', to: '2027-01-31', limit: 500, offset: 0 },
        'UTC',
      ),
    ).toEqual({ from: '2026-01-31', to: '2027-01-31' });
  });
});
