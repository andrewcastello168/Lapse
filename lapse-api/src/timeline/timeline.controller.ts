import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/request.js';
import { requestZone } from '../auth/request.js';
import { TimelineService } from './timeline.service.js';
import { QueryTimelineDto, ReminderQueryDto } from './query-timeline.dto.js';
@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}
  @Get() getTimeline(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryTimelineDto,
  ) {
    return this.timelineService.getTimeline(
      req.user.sub,
      query,
      requestZone(req),
    );
  }
}
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly timelineService: TimelineService) {}
  @Get() findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReminderQueryDto,
  ) {
    return this.timelineService.reminders(
      req.user.sub,
      query.offset,
      query.hour,
      requestZone(req),
    );
  }
}
