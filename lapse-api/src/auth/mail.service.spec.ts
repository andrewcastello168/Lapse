import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
describe('reset email configuration', () => {
  afterEach(() => vi.unstubAllEnvs());
  function valid() {
    vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_FROM', 'Lapse <test@example.test>');
    vi.stubEnv('SMTP_USER', 'test@example.test');
    vi.stubEnv('SMTP_PASSWORD', 'test-only-password');
    vi.stubEnv('PASSWORD_RESET_URL', 'https://api.example.test/auth/reset');
    vi.stubEnv('SMTP_ALLOW_INSECURE', 'false');
  }
  it('accepts complete STARTTLS/TLS configuration without sending email', () => {
    valid();
    expect(() => new MailService().assertConfigured()).not.toThrow();
    vi.stubEnv('SMTP_PORT', '465');
    expect(() => new MailService().assertConfigured()).not.toThrow();
  });
  it('rejects missing credentials and invalid reset URLs before account lookup', () => {
    for (const key of ['SMTP_FROM', 'SMTP_PASSWORD', 'PASSWORD_RESET_URL']) {
      valid();
      vi.stubEnv(key, '');
      expect(() => new MailService().assertConfigured()).toThrow(
        'temporarily unavailable',
      );
    }
    for (const url of [
      'lapsemobile://auth',
      'http://api.example.test/auth/reset',
      'not a URL',
      'https://user:password@example.test/auth/reset',
    ]) {
      valid();
      vi.stubEnv('PASSWORD_RESET_URL', url);
      expect(() => new MailService().assertConfigured()).toThrow(
        'temporarily unavailable',
      );
    }
  });
});
