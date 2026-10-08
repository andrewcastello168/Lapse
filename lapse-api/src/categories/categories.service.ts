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
      .select('id', 'name')
      .where('is_active', true);
  }
}
