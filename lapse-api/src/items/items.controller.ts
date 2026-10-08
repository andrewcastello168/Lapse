import { Controller, Get, Param } from '@nestjs/common';
import { ItemsService } from './items.service.js';

@Controller('categories')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get(':categoryId/items')
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.itemsService.findByCategory(categoryId);
  }
}
