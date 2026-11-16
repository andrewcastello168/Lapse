import { describe, it, expect, vi } from 'vitest';
import { UserItemsController } from './user-items.controller.js';
import { UserItemsService } from './user-items.service.js';
import type { AuthenticatedRequest } from '../auth/request.js';
describe('item controller ownership', () => {
  it('takes ownership from the JWT for every operation, including renewal', () => {
    const service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      renew: vi.fn(),
    };
    const controller = new UserItemsController(
      service as unknown as UserItemsService,
    );
    const req = {
      headers: { 'x-timezone': 'Asia/Jakarta' },
      user: { sub: 'owner' },
    } as unknown as AuthenticatedRequest;
    void controller.findAll(req);
    void controller.findOne(req, 'item');
    void controller.update(req, 'item', {});
    void controller.remove(req, 'item');
    void controller.renew(req, 'item', {
      expected_expiry_date: '2026-01-01',
      new_expiry_date: '2027-01-01',
    });
    expect(service.findAll).toHaveBeenCalledWith('owner', 'Asia/Jakarta');
    expect(service.update).toHaveBeenCalledWith(
      'owner',
      'item',
      {},
      'Asia/Jakarta',
    );
    expect(service.remove).toHaveBeenCalledWith('owner', 'item');
    expect(service.renew.mock.calls[0][0]).toBe('owner');
  });
});
