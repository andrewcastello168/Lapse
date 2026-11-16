import { describe, it, expect, vi } from 'vitest';
import type { Knex } from 'knex';
import { ItemsService } from './items.service.js';
describe('ItemsService', () => {
  it('reads active catalog rows from existing physical tables', async () => {
    const q = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      modify: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const db = Object.assign(vi.fn().mockReturnValue(q), { raw: vi.fn() });
    const service = new ItemsService(db as unknown as Knex);
    expect(await service.findAll({})).toEqual([]);
    expect(db).toHaveBeenCalledWith('master_items as mi');
    expect(q.where).toHaveBeenCalledWith('mi.is_active', true);
  });
});
