import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    for (const [id, entry] of this.attempts)
      if (entry.until <= now) this.attempts.delete(id);
    const entry = this.attempts.get(key) ?? {
      count: 0,
      until: now + 15 * 60000,
    };
    entry.count++;
    this.attempts.set(key, entry);
    if (entry.count > 20)
      throw new HttpException(
        'Too many attempts. Please try again in 15 minutes',
        429,
      );
    return true;
  }
}
