import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { DATABASE } from '../database/database.js';
import { withImages } from '../catalog-images.js';
import { QueryItemsDto } from './dto/query-items.dto.js';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  // GET /items?categoryId=2&search=spo
  async findAll({ categoryId, search }: QueryItemsDto) {
    const rows = await this.db<{
      id: string;
      mc_id: number;
      name: string;
      image_path: string | null;
      category_image_path: string | null;
    }>('master_items as mi')
      .leftJoin('master_categories as mc', 'mi.mc_id', 'mc.id')
      .select(
        'mi.id',
        'mi.mc_id',
        'mi.name',
        'mi.image_path',
        'mc.image_path as category_image_path',
        // Optional catalog defaults are absent in the inspected legacy schema.
        // JSON projection exposes them when supplied without requiring DDL or
        // exposing arbitrary catalog columns.
        ...[
          'expiry_type',
          'expiry_date',
          'recurrence_years',
          'recurrence_months',
          'recurrence_days',
          'renewal_mode',
        ].map((field) => this.db.raw('to_jsonb(mi)->? as ??', [field, field])),
      )
      .where('mi.is_active', true)
      .modify((qb) => {
        if (categoryId !== undefined) {
          qb.where('mi.mc_id', categoryId);
        }
        if (search) {
          qb.whereILike('mi.name', `%${search}%`);
        }
      })
      .orderBy('mi.name', 'asc');
    return Promise.all(rows.map(withImages));
  }
}
