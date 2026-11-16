import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { DATABASE } from '../database/database.js';
import {
  CreateUserItemDto,
  ExpiryType,
  RenewalMode,
} from './dto/create-user-item.dto.js';
import { UpdateUserItemDto } from './dto/update-user-item.dto.js';
import { RenewUserItemDto } from './dto/renew-user-item.dto.js';
import { derived, parseDate } from '../expiration/calendar.js';
import type { UserItemRow } from '../expiration/models.js';
import { withImages } from '../catalog-images.js';

@Injectable()
export class UserItemsService {
  constructor(@Inject(DATABASE) private readonly db: Knex) {}
  private query(userId: string) {
    return this.db<UserItemRow>('user_items as ui')
      .leftJoin('master_categories as mc', 'ui.mc_id', 'mc.id')
      .leftJoin('master_items as mi', 'ui.mi_id', 'mi.id')
      .select(
        'ui.*',
        'mc.name as category_name',
        'mc.image_path as category_image_path',
        this.db.raw(
          "COALESCE(NULLIF(mi.image_path,''), mc.image_path) as image_path",
        ),
      )
      .where('ui.user_id', userId);
  }
  private async present(row: UserItemRow, zone: string) {
    return withImages({ ...row, ...derived(row, zone) });
  }
  async findAll(userId: string, zone = 'UTC') {
    const rows = await this.query(userId).orderBy('ui.id', 'desc');
    return Promise.all(rows.map((row) => this.present(row, zone)));
  }
  async findOne(userId: string, id: string, zone = 'UTC') {
    const row = await this.query(userId).where('ui.id', id).first();
    if (!row) throw new NotFoundException('Item not found');
    return this.present(row, zone);
  }
  private schedule(
    dto: Pick<
      CreateUserItemDto,
      | 'expiryType'
      | 'expiryDate'
      | 'recurrenceYears'
      | 'recurrenceMonths'
      | 'recurrenceDays'
      | 'renewalMode'
    >,
  ) {
    if (!Object.values(ExpiryType).includes(dto.expiryType))
      throw new BadRequestException('Invalid expiry type');
    const recurring = dto.expiryType === ExpiryType.RECURRING;
    if (dto.expiryType !== ExpiryType.NEVER) parseDate(dto.expiryDate ?? '');
    const components = [
      dto.recurrenceYears ?? 0,
      dto.recurrenceMonths ?? 0,
      dto.recurrenceDays ?? 0,
    ];
    if (
      recurring &&
      (!components.every((n) => Number.isInteger(n) && n >= 0 && n <= 999) ||
        !components.some((n) => n > 0))
    )
      throw new BadRequestException(
        'Choose at least one positive recurrence component (0–999 each)',
      );
    return {
      expiry_type: dto.expiryType,
      expiry_date: dto.expiryType === ExpiryType.NEVER ? null : dto.expiryDate!,
      recurrence_years: recurring ? components[0] : null,
      recurrence_months: recurring ? components[1] : null,
      recurrence_days: recurring ? components[2] : null,
      renewal_mode: recurring
        ? (dto.renewalMode ?? RenewalMode.AUTOMATIC)
        : null,
    };
  }
  async create(userId: string, dto: CreateUserItemDto, zone = 'UTC') {
    const schedule = this.schedule(dto);
    let mcId = dto.mcId;
    let itemName = dto.itemName?.trim();
    if (dto.miId != null) {
      const master = await this.db<{
        id: number;
        is_active: boolean;
        mc_id: number;
        name: string;
      }>('master_items')
        .select('mc_id', 'name')
        .where({ id: dto.miId, is_active: true })
        .first();
      if (!master) throw new NotFoundException('Master item not found');
      mcId = master.mc_id;
      itemName = master.name;
    } else {
      if (
        !(await this.db('master_categories')
          .where({ id: mcId, is_active: true })
          .first())
      )
        throw new NotFoundException('Category not found');
      if (!itemName) throw new BadRequestException('Enter an item name');
    }
    const [row] = await this.db<UserItemRow>('user_items')
      .insert({
        user_id: userId,
        mi_id: dto.miId ?? null,
        mc_id: mcId!,
        item_name: itemName!,
        ...schedule,
      })
      .returning('id');
    return this.findOne(userId, row.id, zone);
  }
  preview(dto: CreateUserItemDto, zone: string) {
    return derived(this.schedule(dto), zone);
  }
  async update(
    userId: string,
    id: string,
    dto: UpdateUserItemDto,
    zone = 'UTC',
  ) {
    if (dto.itemName !== undefined && typeof dto.itemName !== 'string')
      throw new BadRequestException('Enter a valid item name');
    await this.db.transaction(async (trx) => {
      const old = await trx<UserItemRow>('user_items')
        .where({ id, user_id: userId })
        .forUpdate()
        .first();
      if (!old) throw new NotFoundException('Item not found');
      // Existing clients send a complete schedule with expiryType and omit
      // unused components. New descriptive/partial PATCH requests preserve it.
      const replacingSchedule = dto.expiryType !== undefined;
      const next = this.schedule({
        expiryType: dto.expiryType ?? (old.expiry_type as ExpiryType),
        expiryDate: dto.expiryDate ?? old.expiry_date ?? undefined,
        recurrenceYears:
          dto.recurrenceYears ??
          (replacingSchedule ? 0 : (old.recurrence_years ?? 0)),
        recurrenceMonths:
          dto.recurrenceMonths ??
          (replacingSchedule ? 0 : (old.recurrence_months ?? 0)),
        recurrenceDays:
          dto.recurrenceDays ??
          (replacingSchedule ? 0 : (old.recurrence_days ?? 0)),
        renewalMode:
          dto.renewalMode ?? (old.renewal_mode as RenewalMode | undefined),
      });
      const material = (Object.keys(next) as (keyof typeof next)[]).some(
        (key) => next[key] !== old[key],
      );
      if (
        material &&
        old.renewed_through &&
        (!dto.resetConfirmation ||
          dto.expectedRenewedThrough !== old.renewed_through)
      )
        throw new ConflictException(
          'Confirm resetting the current renewal confirmation before changing this schedule',
        );
      if (old.mi_id && (dto.mcId !== undefined || dto.itemName !== undefined))
        throw new BadRequestException(
          'Catalog item identity is managed by the catalog',
        );
      if (
        dto.mcId !== undefined &&
        !(await trx('master_categories')
          .where({ id: dto.mcId, is_active: true })
          .first())
      )
        throw new NotFoundException('Category not found');
      if (dto.itemName !== undefined && !dto.itemName.trim())
        throw new BadRequestException('Enter an item name');
      await trx('user_items')
        .where({ id, user_id: userId })
        .update({
          ...next,
          renewed_through: material ? null : old.renewed_through,
          ...(dto.mcId !== undefined ? { mc_id: dto.mcId } : {}),
          ...(dto.itemName !== undefined
            ? { item_name: dto.itemName.trim() }
            : {}),
          updated_at: trx.fn.now(),
        });
    });
    return this.findOne(userId, id, zone);
  }
  async renew(userId: string, id: string, dto: RenewUserItemDto, zone = 'UTC') {
    parseDate(dto.expected_expiry_date);
    parseDate(dto.new_expiry_date);
    if (dto.new_expiry_date <= dto.expected_expiry_date)
      throw new BadRequestException(
        'New validity must be later than the current expiration',
      );
    await this.db.transaction(async (trx) => {
      const item = await trx<UserItemRow>('user_items')
        .where({ id, user_id: userId })
        .forUpdate()
        .first();
      if (!item) throw new NotFoundException('Item not found');
      if (
        item.expiry_type === 'NEVER' ||
        (item.expiry_type === 'RECURRING' && item.renewal_mode !== 'MANUAL')
      )
        throw new BadRequestException(
          'This item does not support renewal confirmation',
        );
      const current = item.renewed_through ?? item.expiry_date;
      if (current !== dto.expected_expiry_date)
        throw new ConflictException(
          'This expiration has changed. Refresh the item before renewing',
        );
      const count = await trx('user_items')
        .where({ id, user_id: userId })
        .whereRaw('COALESCE(renewed_through, expiry_date) = ?::date', [
          dto.expected_expiry_date,
        ])
        .update({
          [item.expiry_type === 'ONCE' ? 'expiry_date' : 'renewed_through']:
            dto.new_expiry_date,
          updated_at: trx.fn.now(),
        });
      if (!count)
        throw new ConflictException('This renewal was already handled');
    });
    return this.findOne(userId, id, zone);
  }
  async remove(userId: string, id: string) {
    if (!(await this.db('user_items').where({ id, user_id: userId }).del()))
      throw new NotFoundException('Item not found');
    return { deleted: true };
  }
}
