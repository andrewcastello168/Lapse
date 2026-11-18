import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';
@Injectable()
export class MailService {
  assertConfigured() {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_FROM ||
      !process.env.PASSWORD_RESET_URL
    )
      throw new ServiceUnavailableException(
        'Password reset email is temporarily unavailable',
      );
  }
  async passwordReset(email: string, token: string) {
    this.assertConfigured();
    const url = new URL(process.env.PASSWORD_RESET_URL!);
    if (
      url.protocol !== 'https:' &&
      !(
        process.env.SMTP_ALLOW_INSECURE === 'true' &&
        ['localhost', '127.0.0.1'].includes(process.env.SMTP_HOST ?? '')
      )
    )
      throw new ServiceUnavailableException(
        'Password reset email is temporarily unavailable',
      );
    url.searchParams.set('mode', 'reset');
    url.searchParams.set('token', token);
    const safeUrl = url
      .toString()
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;');
    const allowLoopback =
      process.env.SMTP_ALLOW_INSECURE === 'true' &&
      ['localhost', '127.0.0.1'].includes(process.env.SMTP_HOST ?? '');
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: !allowLoopback,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Reset your Lapse password',
        html: `<div style="font-family:Arial,sans-serif;background:#fafafa;padding:32px;color:#171717"><h1>lapse.</h1><h2>Choose a new password</h2><p>Use the button below within 30 minutes. This link works once.</p><p><a style="background:#007e58;color:white;padding:14px 22px;border-radius:10px;display:inline-block" href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
        text: `Use this link to choose a new password:\n\n${url.toString()}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Password reset email could not be sent. Please try again later',
      );
    } finally {
      transport.close();
    }
  }
}
