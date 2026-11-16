import { describe, it, expect, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
describe('auth HTTP delegation', () => {
  it('passes validated refresh/logout tokens without changing the token contract', () => {
    const service = { refresh: vi.fn(), logout: vi.fn() };
    const controller = new AuthController(service as unknown as AuthService);
    void controller.refresh({ refreshToken: 'token' });
    void controller.logout({ refreshToken: 'token' });
    expect(service.refresh).toHaveBeenCalledWith('token');
    expect(service.logout).toHaveBeenCalledWith('token');
  });
});
