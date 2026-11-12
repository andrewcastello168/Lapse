import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateUserItemDto } from './dto/create-user-item.dto.js';
import { UpdateUserItemDto } from './dto/update-user-item.dto.js';
import { UserItemsService } from './user-items.service.js';

type AuthenticatedRequest = Request & { user: { sub: string } };

@Controller('user-items')
@UseGuards(JwtAuthGuard)
export class UserItemsController {
  constructor(private readonly userItemsService: UserItemsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.userItemsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.userItemsService.findOne(req.user.sub, id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserItemDto) {
    return this.userItemsService.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserItemDto,
  ) {
    return this.userItemsService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.userItemsService.remove(req.user.sub, id);
  }
}
