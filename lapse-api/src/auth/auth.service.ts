import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Knex } from 'knex';
import argon2 from 'argon2';
import crypto from 'node:crypto';

import { Inject } from '@nestjs/common';

import { DATABASE } from '../database/database.js';

import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,

    private readonly jwtService: JwtService,
  ) {}

  // ============================================================
  // SIGNUP
  // ============================================================

  async signup(body: SignupDto) {
    const existingUser = await this.db('master_users')
      .where('email', body.email)
      .first();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(body.password);

    const [user] = await this.db('master_users')
      .insert({
        name: body.name,
        email: body.email,
        password: passwordHash,
      })
      .returning(['id', 'name', 'email']);

    return {
      message: 'Signup successful',
      user,
    };
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async login(body: LoginDto) {
    const user = await this.db('master_users')
      .select('id', 'name', 'email', 'password', 'is_active')
      .where('email', body.email)
      .first();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account is inactive');
    }

    const passwordValid = await argon2.verify(user.password, body.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate access token
    const accessToken = await this.generateAccessToken(user.id);

    // Create new device/session family
    const familyId = crypto.randomUUID();

    // Create refresh token
    const refreshToken = await this.createRefreshToken(user.id, familyId);

    return {
      accessToken,
      refreshToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  // ============================================================
  // REFRESH
  // ============================================================

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(refreshToken);

    return this.db.transaction(async (trx) => {
      // Lock row supaya concurrent refresh aman
      const storedToken = await trx('master_refresh_tokens')
        .where('token_hash', tokenHash)
        .forUpdate()
        .first();

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // ========================================================
      // REUSE DETECTION
      // ========================================================

      if (storedToken.revoked_at) {
        // Token lama dipakai lagi.
        // Anggap token family sudah compromised.

        await trx('master_refresh_tokens')
          .where('family_id', storedToken.family_id)
          .whereNull('revoked_at')
          .update({
            revoked_at: trx.fn.now(),
          });

        throw new UnauthorizedException('Refresh token reuse detected');
      }

      // ========================================================
      // EXPIRY CHECK
      // ========================================================

      if (new Date(storedToken.expires_at) <= new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // ========================================================
      // USER CHECK
      // ========================================================

      const user = await trx('master_users')
        .select('id', 'name', 'email', 'is_active')
        .where('id', storedToken.user_id)
        .first();

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User account is inactive');
      }

      // ========================================================
      // ROTATE OLD TOKEN
      // ========================================================

      await trx('master_refresh_tokens')
        .where('refresh_token_id', storedToken.refresh_token_id)
        .update({
          revoked_at: trx.fn.now(),
        });

      // ========================================================
      // CREATE NEW ACCESS TOKEN
      // ========================================================

      const accessToken = await this.generateAccessToken(user.id);

      // ========================================================
      // CREATE NEW REFRESH TOKEN
      // SAME FAMILY
      // ========================================================

      const newRefreshToken = await this.createRefreshToken(
        user.id,
        storedToken.family_id,
        trx,
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    await this.db('master_refresh_tokens')
      .where('token_hash', tokenHash)
      .whereNull('revoked_at')
      .update({
        revoked_at: this.db.fn.now(),
      });

    return {
      message: 'Logout successful',
    };
  }

  // ============================================================
  // ACCESS TOKEN
  // ============================================================

  private async generateAccessToken(userId: string) {
    return this.jwtService.signAsync({
      sub: userId,
    });
  }

  // ============================================================
  // CREATE REFRESH TOKEN
  // ============================================================

  private async createRefreshToken(
    userId: string,
    familyId: string,
    trx?: Knex.Transaction,
  ) {
    const db = trx ?? this.db;

    // 256-bit random token
    const rawToken = crypto.randomBytes(32).toString('base64url');

    const tokenHash = this.hashToken(rawToken);

    // Sliding expiration:
    // 30 days from NOW
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db('master_refresh_tokens').insert({
      user_id: userId,
      family_id: familyId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return rawToken;
  }

  // ============================================================
  // HASH REFRESH TOKEN
  // ============================================================

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
