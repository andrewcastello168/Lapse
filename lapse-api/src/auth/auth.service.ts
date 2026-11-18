import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Knex } from 'knex';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { DATABASE } from '../database/database.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ProfileDto, ChangePasswordDto } from './dto/account.dto.js';
import { MailService } from './mail.service.js';
import { timezone } from '../expiration/calendar.js';
type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  is_active: boolean;
  timezone: string | null;
  token_version: number;
};
type Refresh = {
  refresh_token_id: string;
  user_id: string;
  family_id: string;
  revoked_at: Date | null;
  expires_at: Date;
};
@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Knex,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}
  private hash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  async signup(body: SignupDto) {
    if (!body.name.trim()) throw new BadRequestException('Enter your name');
    const email = body.email.trim().toLowerCase();
    if (
      await this.db('master_users').whereRaw('lower(email)=?', [email]).first()
    )
      throw new ConflictException('Email already registered');
    const [user] = await this.db<User>('master_users')
      .insert({
        name: body.name.trim(),
        email,
        password: await argon2.hash(body.password),
      })
      .returning(['id', 'name', 'email']);
    return { message: 'Signup successful', user };
  }
  async login(body: LoginDto) {
    return this.db.transaction(async (trx) => {
      const user = await trx<User>('master_users')
        .whereRaw('lower(email)=?', [body.email.trim().toLowerCase()])
        .forUpdate()
        .first();
      if (
        !user ||
        !user.is_active ||
        !(await argon2.verify(user.password, body.password))
      )
        throw new UnauthorizedException('Invalid email or password');
      return {
        accessToken: await this.access(user),
        refreshToken: await this.createRefresh(
          user.id,
          crypto.randomUUID(),
          trx,
        ),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          timezone: user.timezone,
        },
      };
    });
  }
  private access(user: User) {
    return this.jwtService.signAsync({ sub: user.id, ver: user.token_version });
  }
  private async createRefresh(
    userId: string,
    familyId: string,
    trx: Knex | Knex.Transaction = this.db,
  ) {
    const token = crypto.randomBytes(32).toString('base64url');
    await trx('master_refresh_tokens').insert({
      user_id: userId,
      family_id: familyId,
      token_hash: this.hash(token),
      expires_at: new Date(Date.now() + 30 * 86400000),
    });
    return token;
  }
  async refresh(token: string) {
    const result = await this.db.transaction(async (trx) => {
      const candidate = await trx<Refresh>('master_refresh_tokens')
        .where('token_hash', this.hash(token))
        .first();
      if (!candidate) throw new UnauthorizedException('Invalid refresh token');
      // Password changes and token issuance share this lock, preventing an
      // in-flight login/refresh from recreating a revoked session afterwards.
      const user = await trx<User>('master_users')
        .where({ id: candidate.user_id, is_active: true })
        .forUpdate()
        .first();
      if (!user) throw new UnauthorizedException('User account is inactive');
      const stored = await trx<Refresh>('master_refresh_tokens')
        .where('token_hash', this.hash(token))
        .forUpdate()
        .first();
      if (!stored) throw new UnauthorizedException('Invalid refresh token');
      if (stored.revoked_at) {
        await trx('master_refresh_tokens')
          .where('family_id', stored.family_id)
          .whereNull('revoked_at')
          .update({ revoked_at: trx.fn.now() });
        // Commit family revocation before reporting rejection.
        return null;
      }
      if (new Date(stored.expires_at).getTime() <= Date.now())
        throw new UnauthorizedException('Refresh token expired');
      await trx('master_refresh_tokens')
        .where('refresh_token_id', stored.refresh_token_id)
        .update({ revoked_at: trx.fn.now() });
      return {
        accessToken: await this.access(user),
        refreshToken: await this.createRefresh(user.id, stored.family_id, trx),
      };
    });
    if (!result)
      throw new UnauthorizedException('Refresh token reuse detected');
    return result;
  }
  async logout(token: string) {
    // Revoke the whole current device family, including a token rotated by an
    // in-flight refresh. Other devices keep their independent sessions.
    await this.db.transaction(async (trx) => {
      const stored = await trx<Refresh>('master_refresh_tokens')
        .where('token_hash', this.hash(token))
        .first();
      if (stored)
        await trx('master_refresh_tokens')
          .where('family_id', stored.family_id)
          .whereNull('revoked_at')
          .update({ revoked_at: trx.fn.now() });
    });
    return { message: 'Logout successful' };
  }
  async profile(userId: string) {
    const user = await this.db<User>('master_users')
      .select('id', 'name', 'email', 'timezone')
      .where({ id: userId, is_active: true })
      .first();
    if (!user) throw new UnauthorizedException('User account is inactive');
    return user;
  }
  async updateProfile(userId: string, body: ProfileDto) {
    if (body.name !== undefined && typeof body.name !== 'string')
      throw new BadRequestException('Enter your name');
    if (body.name !== undefined && !body.name.trim())
      throw new BadRequestException('Enter your name');
    await this.db('master_users')
      .where('id', userId)
      .update({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.timezone !== undefined
          ? { timezone: timezone(body.timezone) }
          : {}),
        updated_at: this.db.fn.now(),
      });
    return this.profile(userId);
  }
  async changePassword(userId: string, body: ChangePasswordDto) {
    await this.db.transaction(async (trx) => {
      const user = await trx<User>('master_users')
        .where('id', userId)
        .forUpdate()
        .first();
      if (!user || !(await argon2.verify(user.password, body.currentPassword)))
        throw new UnauthorizedException('Current password is incorrect');
      await this.setPassword(trx, userId, body.newPassword);
    });
    return { message: 'Password changed. Sign in again on your devices' };
  }
  private async setPassword(
    trx: Knex.Transaction,
    userId: string,
    password: string,
  ) {
    await trx('master_users')
      .where('id', userId)
      .update({
        password: await argon2.hash(password),
        token_version: trx.raw('token_version + 1'),
        updated_at: trx.fn.now(),
      });
    await trx('master_refresh_tokens')
      .where('user_id', userId)
      .whereNull('revoked_at')
      .update({ revoked_at: trx.fn.now() });
    await trx('password_reset_tokens')
      .where('user_id', userId)
      .whereNull('used_at')
      .update({ used_at: trx.fn.now() });
  }
  async forgotPassword(email: string) {
    this.mail.assertConfigured();
    const message = {
      message:
        'If an account exists for this email, a password reset link will be sent',
    };
    const user = await this.db<User>('master_users')
      .whereRaw('lower(email)=?', [email.trim().toLowerCase()])
      .where('is_active', true)
      .first();
    if (!user) return message;
    const token = crypto.randomBytes(32).toString('base64url');
    const inserted = await this.db.transaction(async (trx) => {
      await trx('master_users').where('id', user.id).forUpdate().first();
      const recent = await trx('password_reset_tokens')
        .where('user_id', user.id)
        .where('created_at', '>', new Date(Date.now() - 60000))
        .first();
      if (recent) return false;
      await trx('password_reset_tokens')
        .where('user_id', user.id)
        .whereNull('used_at')
        .update({ used_at: trx.fn.now() });
      await trx('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: this.hash(token),
        expires_at: new Date(Date.now() + 30 * 60000),
      });
      return true;
    });
    if (inserted) {
      try {
        await this.mail.passwordReset(user.email, token);
      } catch {
        await this.db('password_reset_tokens')
          .where('token_hash', this.hash(token))
          .del();
        return message;
      }
    }
    return message;
  }
  async resetPassword(token: string, password: string) {
    await this.db.transaction(async (trx) => {
      const candidate = await trx<{ user_id: string }>('password_reset_tokens')
        .where('token_hash', this.hash(token))
        .first();
      if (!candidate)
        throw new BadRequestException(
          'This reset link is invalid or has expired',
        );
      const account = await trx<User>('master_users')
        .where({ id: candidate.user_id, is_active: true })
        .forUpdate()
        .first();
      if (!account)
        throw new BadRequestException(
          'This reset link is invalid or has expired',
        );
      const reset = await trx<{
        id: string;
        user_id: string;
        expires_at: Date;
        used_at: Date | null;
      }>('password_reset_tokens')
        .where('token_hash', this.hash(token))
        .forUpdate()
        .first();
      if (
        !reset ||
        reset.used_at ||
        new Date(reset.expires_at).getTime() <= Date.now()
      )
        throw new BadRequestException(
          'This reset link is invalid or has expired',
        );
      await this.setPassword(trx, reset.user_id, password);
    });
    return {
      message: 'Your password has been reset. Sign in with your new password',
    };
  }
}
