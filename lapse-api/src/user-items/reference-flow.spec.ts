import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { vi } from 'vitest';
import { UserItemsService } from './user-items.service.js';
import { UserItemsController } from './user-items.controller.js';
import { ExpiryType } from './dto/create-user-item.dto.js';
function setup() {
  const q = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    first: vi.fn(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    del: vi.fn(),
  };
  const db = Object.assign(vi.fn().mockReturnValue(q), {
    raw: vi.fn().mockReturnValue('image_path'),
  });
  return { q, service: new UserItemsService(db as unknown as Knex) };
}
describe('reference-flow user item operations', () => {
  it('lists tracked rows including NEVER scoped to the signed-in user', async () => {
    const { q, service } = setup();
    const rows = [{ id: 1, expiry_type: 'NEVER' }];
    q.orderBy.mockResolvedValue(rows);
    expect(await service.findAll('owner')).toEqual(rows);
    expect(q.where).toHaveBeenCalledWith('ui.user_id', 'owner');
  });
  it('scopes detail reads and hides another user item', async () => {
    const { q, service } = setup();
    q.first.mockResolvedValue(undefined);
    await expect(service.findOne('owner', '9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(q.where).toHaveBeenCalledWith('ui.user_id', 'owner');
    expect(q.where).toHaveBeenCalledWith('ui.id', '9');
  });
  it('clears stale dates and intervals when editing to no expiry', async () => {
    const { q, service } = setup();
    q.returning.mockResolvedValue([{ id: 9 }]);
    q.first.mockResolvedValue({ id: 9, expiry_type: 'NEVER' });
    await service.update('owner', '9', { expiryType: ExpiryType.NEVER });
    expect(q.where).toHaveBeenCalledWith({ id: '9', user_id: 'owner' });
    expect(q.update).toHaveBeenCalledWith({
      expiry_type: 'NEVER',
      expiry_date: null,
      recurrence_years: null,
      recurrence_months: null,
      recurrence_days: null,
    });
  });
  it('preserves recurring anchors and clears unused units', async () => {
    const { q, service } = setup();
    q.returning.mockResolvedValue([{ id: 9 }]);
    q.first.mockResolvedValue({ id: 9 });
    await service.update('owner', '9', {
      expiryType: ExpiryType.RECURRING,
      expiryDate: '2026-01-31',
      recurrenceMonths: 1,
    });
    expect(q.update).toHaveBeenCalledWith({
      expiry_type: 'RECURRING',
      expiry_date: '2026-01-31',
      recurrence_years: null,
      recurrence_months: 1,
      recurrence_days: null,
    });
  });
  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])(
    'rejects invalid calendar date %s',
    async (expiryDate) => {
      const { service } = setup();
      await expect(
        service.update('owner', '9', {
          expiryType: ExpiryType.ONCE,
          expiryDate,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('rejects a recurring item without an interval', async () => {
    const { q, service } = setup();
    await expect(
      service.update('owner', '9', {
        expiryType: ExpiryType.RECURRING,
        expiryDate: '2026-11-09',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(q.update).not.toHaveBeenCalled();
  });
  it('cannot update another user item', async () => {
    const { q, service } = setup();
    q.returning.mockResolvedValue([]);
    await expect(
      service.update('owner', '9', { expiryType: ExpiryType.NEVER }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(q.where).toHaveBeenCalledWith({ id: '9', user_id: 'owner' });
  });
  it('scopes deletion and reports an absent item', async () => {
    const { q, service } = setup();
    q.del.mockResolvedValue(0);
    await expect(service.remove('owner', '9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(q.where).toHaveBeenCalledWith({ id: '9', user_id: 'owner' });
  });
  it('deletes exactly the owned item', async () => {
    const { q, service } = setup();
    q.del.mockResolvedValue(1);
    expect(await service.remove('owner', '9')).toEqual({ deleted: true });
    expect(q.where).toHaveBeenCalledWith({ id: '9', user_id: 'owner' });
  });
  it('creates a custom item in the selected category', async () => {
    const { q, service } = setup();
    q.first.mockResolvedValue({ id: 5 });
    q.returning.mockResolvedValue([{ id: 10 }]);
    await service.create('owner', {
      mcId: 5,
      itemName: '  Permit  ',
      expiryType: ExpiryType.NEVER,
    });
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'owner',
        mc_id: 5,
        mi_id: null,
        item_name: 'Permit',
        expiry_type: 'NEVER',
        expiry_date: null,
      }),
    );
  });
  it('takes a ready-made item name and category from the master', async () => {
    const { q, service } = setup();
    q.first.mockResolvedValue({ id: 2, mc_id: 1, name: 'SIM' });
    q.returning.mockResolvedValue([{ id: 10 }]);
    await service.create('owner', {
      miId: 2,
      expiryType: ExpiryType.ONCE,
      expiryDate: '2031-10-15',
    });
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        mi_id: 2,
        mc_id: 1,
        item_name: 'SIM',
        expiry_date: '2031-10-15',
      }),
    );
  });
  it('uses the JWT subject for every controller operation', async () => {
    const service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const controller = new UserItemsController(
      service as unknown as UserItemsService,
    );
    const req = { user: { sub: 'jwt-owner' } } as Parameters<
      UserItemsController['findAll']
    >[0];
    const dto = { expiryType: ExpiryType.NEVER };
    await controller.findAll(req);
    await controller.findOne(req, '9');
    await controller.create(req, dto);
    await controller.update(req, '9', dto);
    await controller.remove(req, '9');
    expect(service.findAll).toHaveBeenCalledWith('jwt-owner');
    expect(service.findOne).toHaveBeenCalledWith('jwt-owner', '9');
    expect(service.create).toHaveBeenCalledWith('jwt-owner', dto);
    expect(service.update).toHaveBeenCalledWith('jwt-owner', '9', dto);
    expect(service.remove).toHaveBeenCalledWith('jwt-owner', '9');
  });
});
