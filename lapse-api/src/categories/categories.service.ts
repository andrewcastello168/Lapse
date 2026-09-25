import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../database/database.js';
import type { Knex } from 'knex';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}
  async findAll() {
    return this.db('master_categories')
      .select('master_id', 'master_category_name')
      .where('master_is_active', true)
      .orderBy('master_category_name');
  }
}
