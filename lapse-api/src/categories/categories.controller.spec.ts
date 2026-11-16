import { describe, it, expect, vi } from 'vitest';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
describe('CategoriesController', () => {
  it('preserves catalog response envelopes', async () => {
    const rows = [{ id: 1, name: 'Catalog' }];
    const service = { findAll: vi.fn().mockResolvedValue(rows) };
    const controller = new CategoriesController(
      service as unknown as CategoriesService,
    );
    expect(await controller.findAll()).toEqual(rows);
  });
});
