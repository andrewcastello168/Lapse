import { describe, it, expect, vi } from 'vitest';
import { TimelineController } from './timeline.controller.js';
import { TimelineService } from './timeline.service.js';
import type { AuthenticatedRequest } from '../auth/request.js';
describe('timeline ownership', () => {
  it('uses the JWT owner and selected timezone', () => {
    const service = { getTimeline: vi.fn() };
    const controller = new TimelineController(
      service as unknown as TimelineService,
    );
    const req = {
      headers: {},
      user: { sub: 'owner', timezone: 'Asia/Bangkok' },
    } as unknown as AuthenticatedRequest;
    void controller.getTimeline(req, {
      from: '2026-01-01',
      to: '2026-02-01',
      limit: 20,
      offset: 0,
    });
    expect(service.getTimeline.mock.calls[0][0]).toBe('owner');
    expect(service.getTimeline.mock.calls[0][2]).toBe('Asia/Bangkok');
  });
});
