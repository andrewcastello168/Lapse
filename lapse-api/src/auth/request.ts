import type { Request } from 'express';
import { timezone } from '../expiration/calendar.js';
export type AuthenticatedRequest = Request & {
  user: { sub: string; timezone?: string };
};
export function requestZone(req: AuthenticatedRequest) {
  const header = req.headers?.['x-timezone'];
  return timezone(
    typeof header === 'string' ? header : (req.user.timezone ?? 'UTC'),
  );
}
