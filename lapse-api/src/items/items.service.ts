import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { DATABASE } from '../database/database.js';
import { QueryItemsDto } from './dto/query-items.dto.js';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  // GET /items?categoryId=2&search=spo
  async findAll({ categoryId, search }: QueryItemsDto) {
    return this.db('master_items')
      .select('id', 'mc_id', 'name', 'image_path')
      .where('is_active', true)
      .modify((qb) => {
        if (categoryId !== undefined) {
          qb.where('mc_id', categoryId);
        }
        if (search) {
          qb.whereILike('name', `%${search}%`);
        }
      })
      .orderBy('name', 'asc');
  }
}
