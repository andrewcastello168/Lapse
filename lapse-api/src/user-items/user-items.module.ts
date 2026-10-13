import { Module } from '@nestjs/common';

import { UserItemsController } from './user-items.controller.js';
import { UserItemsService } from './user-items.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UserItemsController],
  providers: [UserItemsService],
})
export class UserItemsModule {}
