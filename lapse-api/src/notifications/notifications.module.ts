import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsService } from './notifications.service.js';
import {
  NotificationCronController,
  NotificationsController,
} from './notifications.controller.js';
@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [NotificationsService],
  controllers: [NotificationsController, NotificationCronController],
})
export class NotificationsModule {}
