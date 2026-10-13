import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateUserItemDto } from './dto/create-user-item.dto.js';
import { UserItemsService } from './user-items.service.js';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
  };
};

@Controller('user-items')
@UseGuards(JwtAuthGuard)
export class UserItemsController {
  constructor(private readonly userItemsService: UserItemsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserItemDto) {
    const userId = req.user.sub;

    return this.userItemsService.create(userId, dto);
  }
}
