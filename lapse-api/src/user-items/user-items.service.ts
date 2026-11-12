import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';

import { DATABASE } from '../database/database.js';
import { CreateUserItemDto, ExpiryType } from './dto/create-user-item.dto.js';
import { UpdateUserItemDto } from './dto/update-user-item.dto.js';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend(customParseFormat);

@Injectable()
export class UserItemsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  private query(userId: string) {
    return this.db('user_items as ui')
      .leftJoin('master_categories as mc', 'ui.mc_id', 'mc.id')
      .leftJoin('master_items as mi', 'ui.mi_id', 'mi.id')
      .select(
        'ui.*',
        'mc.name as category_name',
        'mc.image_path as category_image_path',
        this.db.raw('COALESCE(mi.image_path, mc.image_path) as image_path'),
      )
      .where('ui.user_id', userId);
  }

  async findAll(userId: string) {
    return this.query(userId).orderBy('ui.id', 'desc');
  }

  async findOne(userId: string, id: string) {
    const row = await this.query(userId).where('ui.id', id).first();
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }

  async update(userId: string, id: string, dto: UpdateUserItemDto) {
    const [row] = await this.db('user_items')
      .where({ id, user_id: userId })
      .update(this.expiryValues(dto))
      .returning('*');
    if (!row) throw new NotFoundException('Item not found');
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const count = await this.db('user_items')
      .where({ id, user_id: userId })
      .del();
    if (!count) throw new NotFoundException('Item not found');
    return { deleted: true };
  }

  private expiryValues(dto: UpdateUserItemDto) {
    const recurring = dto.expiryType === ExpiryType.RECURRING;
    const never = dto.expiryType === ExpiryType.NEVER;
    if (!Object.values(ExpiryType).includes(dto.expiryType)) {
      throw new BadRequestException('Invalid expiry type');
    }
    if (
      !never &&
      (!dto.expiryDate || !dayjs(dto.expiryDate, 'YYYY-MM-DD', true).isValid())
    ) {
      throw new BadRequestException(
        'A valid date in YYYY-MM-DD format is required',
      );
    }
    const intervals = [
      dto.recurrenceYears ?? 0,
      dto.recurrenceMonths ?? 0,
      dto.recurrenceDays ?? 0,
    ];
    if (
      recurring &&
      (!intervals.every((v) => Number.isInteger(v) && v >= 0) ||
        !intervals.some((v) => v > 0))
    ) {
      throw new BadRequestException(
        'A positive recurrence interval is required',
      );
    }
    return {
      expiry_type: dto.expiryType,
      expiry_date: never ? null : dto.expiryDate,
      recurrence_years: recurring ? dto.recurrenceYears || null : null,
      recurrence_months: recurring ? dto.recurrenceMonths || null : null,
      recurrence_days: recurring ? dto.recurrenceDays || null : null,
    };
  }

  // POST /user-items
  async create(userId: string, dto: CreateUserItemDto) {
    this.expiryValues(dto);
    let mcId = dto.mcId;
    let itemName = dto.itemName;

    if (dto.miId != null) {
      // Master item: ambil kategori dan nama dari database.
      const master = await this.db('master_items')
        .select('id', 'mc_id', 'name')
        .where({
          id: dto.miId,
          is_active: true,
        })
        .first();

      if (!master) {
        throw new NotFoundException('Master item tidak ditemukan');
      }

      mcId = master.mc_id;
      itemName = master.name;
    } else {
      // Custom item: kategori harus valid dan aktif.
      const category = await this.db('master_categories')
        .select('id')
        .where({
          id: mcId,
          is_active: true,
        })
        .first();

      if (!category) {
        throw new NotFoundException('Kategori tidak ditemukan');
      }

      if (!itemName?.trim()) {
        throw new BadRequestException('Nama item wajib diisi');
      }

      itemName = itemName.trim();
    }

    const isRecurring = dto.expiryType === ExpiryType.RECURRING;

    const years = dto.recurrenceYears ?? 0;
    const months = dto.recurrenceMonths ?? 0;
    const days = dto.recurrenceDays ?? 0;

    if (isRecurring) {
      const validIntervals = [years, months, days].every(
        (value) => Number.isInteger(value) && value >= 0,
      );

      if (!validIntervals || (years === 0 && months === 0 && days === 0)) {
        throw new BadRequestException(
          'RECURRING wajib memiliki interval positif berupa tahun, bulan, atau hari',
        );
      }

      if (!dto.expiryDate) {
        throw new BadRequestException(
          'Expiry date wajib diisi untuk RECURRING',
        );
      }
    }

    if (dto.expiryType === ExpiryType.ONCE && !dto.expiryDate) {
      throw new BadRequestException('Expiry date wajib diisi untuk ONCE');
    }

    const [row] = await this.db('user_items')
      .insert({
        user_id: userId,
        mi_id: dto.miId ?? null,
        mc_id: mcId,
        item_name: itemName,
        expiry_type: dto.expiryType,
        recurrence_years: isRecurring ? dto.recurrenceYears || null : null,
        recurrence_months: isRecurring ? dto.recurrenceMonths || null : null,
        recurrence_days: isRecurring ? dto.recurrenceDays || null : null,
        expiry_date:
          dto.expiryType === ExpiryType.NEVER ? null : dto.expiryDate,
      })
      .returning('*');
    return row;
  }
}
