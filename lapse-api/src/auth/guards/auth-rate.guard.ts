import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { Knex } from 'knex';
import { DATABASE } from '../../database/database.js';
@Injectable()
export class AuthRateGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Knex) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const key = createHash('sha256')
      .update(`${req.ip}:${req.path}`)
      .digest('hex');
    const result = await this.db.raw(
      `INSERT INTO auth_rate_limits (key,count,until) VALUES (?,1,now()+interval '15 minutes')
      ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_rate_limits.until<=now() THEN 1 ELSE auth_rate_limits.count+1 END,
      until=CASE WHEN auth_rate_limits.until<=now() THEN now()+interval '15 minutes' ELSE auth_rate_limits.until END RETURNING count`,
      [key],
    );
    await this.db('auth_rate_limits')
      .whereIn(
        'key',
        this.db('auth_rate_limits')
          .select('key')
          .where('until', '<', this.db.fn.now())
          .limit(100),
      )
      .delete();
    if (Number(result.rows[0].count) > 20)
      throw new HttpException(
        'Too many attempts. Please try again in 15 minutes',
        429,
      );
    return true;
  }
}
