import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { DATABASE } from '../database/database.js';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  async findByCategory(categoryId: string) {
    return this.db('master_items')
      .select('id', 'name', 'image_path')
      .where('mc_id', categoryId)
      .where('is_active', true)
      .orderBy('name');
  }
}
