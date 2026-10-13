import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Knex } from 'knex';

import { DATABASE } from '../../database/database.js';

type JwtPayload = {
  sub: string;
};

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
  };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,

    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token required');
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    // Pastikan user masih aktif.
    const user = await this.db('master_users')
      .select('id', 'is_active')
      .where('id', payload.sub)
      .first();

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User account is inactive');
    }

    request.user = {
      sub: user.id,
    };

    return true;
  }
}
