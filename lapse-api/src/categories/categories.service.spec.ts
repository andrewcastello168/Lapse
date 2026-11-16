import { describe, it, expect, vi } from 'vitest';
import type { Knex } from 'knex';
import { CategoriesService } from './categories.service.js';
describe('CategoriesService', () => {
  it('reads active catalog rows from existing physical tables', async () => {
    const q = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      modify: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const db = vi.fn().mockReturnValue(q);
    const service = new CategoriesService(db as unknown as Knex);
    expect(await service.findAll()).toEqual([]);
    expect(db).toHaveBeenCalledWith('master_categories');
    expect(q.where).toHaveBeenCalledWith('is_active', true);
  });
});
