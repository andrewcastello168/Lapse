import { Module } from '@nestjs/common';

import {
  TimelineController,
  RemindersController,
} from './timeline.controller.js';
import { TimelineService } from './timeline.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TimelineController, RemindersController],
  providers: [TimelineService],
})
export class TimelineModule {}
