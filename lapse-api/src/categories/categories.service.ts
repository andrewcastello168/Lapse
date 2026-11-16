import { Injectable, Inject } from '@nestjs/common';
import { withImages } from '../catalog-images.js';
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
    const rows = await this.db<{
      id: number;
      name: string;
      image_path: string | null;
    }>('master_categories')
      .select('id', 'name', 'image_path')
      .where('is_active', true)
      .orderBy('id');
    return Promise.all(rows.map(withImages));
  }
}
