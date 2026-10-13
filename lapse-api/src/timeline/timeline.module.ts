import { Module } from '@nestjs/common';

import { TimelineController } from './timeline.controller.js';
import { TimelineService } from './timeline.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TimelineController],
  providers: [TimelineService],
})
export class TimelineModule {}
