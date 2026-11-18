import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/request.js';
import {
  DeviceDto,
  ItemNotificationDto,
  NotificationPreferencesDto,
  ReadNotificationDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get('preferences') preferences(@Req() req: AuthenticatedRequest) {
    return this.service.preferences(req.user.sub);
  }
  @Patch('preferences') save(
    @Req() req: AuthenticatedRequest,
    @Body() body: NotificationPreferencesDto,
  ) {
    return this.service.savePreferences(req.user.sub, body);
  }
  @Post('devices') @HttpCode(200) device(
    @Req() req: AuthenticatedRequest,
    @Body() body: DeviceDto,
  ) {
    return this.service.device(req.user.sub, body);
  }
  @Delete('devices/:id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeDevice(req.user.sub, id);
  }
  @Get('items/:id') item(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.itemPreferences(req.user.sub, id);
  }
  @Patch('items/:id') saveItem(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ItemNotificationDto,
  ) {
    return this.service.itemPreferences(req.user.sub, id, body);
  }
  @Get() inbox(@Req() req: AuthenticatedRequest) {
    return this.service.inbox(req.user.sub);
  }
  @Post('read') @HttpCode(200) read(
    @Req() req: AuthenticatedRequest,
    @Body() body: ReadNotificationDto,
  ) {
    return this.service.read(req.user.sub, body.id);
  }
}
@Controller('internal/notifications')
export class NotificationCronController {
  constructor(private readonly service: NotificationsService) {}
  @Post('dispatch') @HttpCode(200) dispatch(
    @Headers('authorization') authorization?: string,
  ) {
    const expected = process.env.CRON_SECRET
      ? `Bearer ${process.env.CRON_SECRET}`
      : '';
    if (
      !expected ||
      !authorization ||
      Buffer.byteLength(expected) !== Buffer.byteLength(authorization) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(authorization))
    )
      throw new UnauthorizedException();
    return {
      configured: false,
      processed: 0,
      reason: 'Scheduled dispatch moved to Supabase Edge and is not activated',
    };
  }
}
