import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/request.js';
import { requestZone } from '../auth/request.js';
import { RenewUserItemDto } from './dto/renew-user-item.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateUserItemDto } from './dto/create-user-item.dto.js';
import { UpdateUserItemDto } from './dto/update-user-item.dto.js';
import { UserItemsService } from './user-items.service.js';

@Controller('user-items')
@UseGuards(JwtAuthGuard)
export class UserItemsController {
  constructor(private readonly userItemsService: UserItemsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.userItemsService.findAll(req.user.sub, requestZone(req));
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.userItemsService.findOne(req.user.sub, id, requestZone(req));
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserItemDto) {
    return this.userItemsService.create(req.user.sub, dto, requestZone(req));
  }
  @Post('preview')
  preview(@Req() req: AuthenticatedRequest, @Body() dto: UpdateUserItemDto) {
    if (!dto.expiryType)
      throw new BadRequestException('Expiry type is required');
    return this.userItemsService.preview(
      dto as CreateUserItemDto,
      requestZone(req),
    );
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserItemDto,
  ) {
    return this.userItemsService.update(
      req.user.sub,
      id,
      dto,
      requestZone(req),
    );
  }

  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.userItemsService.remove(req.user.sub, id);
  }

  @Post(':id/renew')
  renew(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewUserItemDto,
  ) {
    return this.userItemsService.renew(req.user.sub, id, dto, requestZone(req));
  }
}
