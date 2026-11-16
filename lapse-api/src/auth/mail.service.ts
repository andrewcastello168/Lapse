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
    url.searchParams.set('mode', 'reset');
    url.searchParams.set('token', token);
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: process.env.SMTP_ALLOW_INSECURE !== 'true',
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
