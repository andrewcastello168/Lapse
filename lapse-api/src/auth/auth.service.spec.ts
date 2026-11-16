import { describe, it, expect, vi } from 'vitest';
import type { Knex } from 'knex';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { MailService } from './mail.service.js';
describe('refresh rotation', () => {
  it('commits compromised-family revocation before rejecting reused tokens', async () => {
    const q = {
      where: vi.fn().mockReturnThis(),
      forUpdate: vi.fn().mockReturnThis(),
      whereNull: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        revoked_at: new Date(),
        family_id: 'device-family',
      }),
      update: vi.fn().mockResolvedValue(1),
    };
    const trx = Object.assign(vi.fn().mockReturnValue(q), {
      fn: { now: () => new Date() },
    });
    let committed = false;
    const db = {
      transaction: async (work: (value: unknown) => Promise<unknown>) => {
        const result = await work(trx);
        committed = true;
        return result;
      },
    };
    const service = new AuthService(
      db as unknown as Knex,
      {} as JwtService,
      {} as MailService,
    );
    await expect(service.refresh('old-token')).rejects.toThrow('reuse');
    expect(committed).toBe(true);
    expect(q.where).toHaveBeenCalledWith('family_id', 'device-family');
  });
});
