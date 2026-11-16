import { describe, it, expect, vi } from 'vitest';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
describe('ItemsController', () => {
  it('preserves catalog response envelopes', async () => {
    const rows = [{ id: 1, name: 'Catalog' }];
    const service = { findAll: vi.fn().mockResolvedValue(rows) };
    const controller = new ItemsController(service as unknown as ItemsService);
    expect(await controller.findAll({})).toEqual(rows);
  });
});
