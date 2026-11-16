import { describe, it, expect, vi } from 'vitest';
import type { Knex } from 'knex';
import { UserItemsService } from './user-items.service.js';
import { ExpiryType } from './dto/create-user-item.dto.js';
describe('item input boundaries', () => {
  const service = () => new UserItemsService(vi.fn() as unknown as Knex);
  it('rejects invalid dates and recurrence before database access', async () => {
    await expect(
      service().create('owner', {
        expiryType: ExpiryType.ONCE,
        expiryDate: '2026-02-30',
      }),
    ).rejects.toThrow('calendar');
    await expect(
      service().create('owner', {
        expiryType: ExpiryType.RECURRING,
        expiryDate: '2026-01-01',
        recurrenceMonths: 0,
      }),
    ).rejects.toThrow('positive');
  });
  it('rejects non-increasing renewals before database access', async () => {
    await expect(
      service().renew('owner', 'item', {
        expected_expiry_date: '2026-11-07',
        new_expiry_date: '2026-11-07',
      }),
    ).rejects.toThrow('later');
  });
});
