import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';

import { DATABASE } from '../database/database.js';
import { CreateUserItemDto, ExpiryType } from './dto/create-user-item.dto.js';

@Injectable()
export class UserItemsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  // POST /user-items
  async create(userId: string, dto: CreateUserItemDto) {
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
    const isNever = dto.expiryType === ExpiryType.NEVER;

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
