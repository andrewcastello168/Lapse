import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { Knex } from 'knex';

import { DATABASE } from '../database/database.js';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  // GET /categories
  async findAll() {
    return this.db('master_categories')
      .select('id', 'name', 'image_path')
      .where('is_active', true)
      .orderBy('id');
  }
}
