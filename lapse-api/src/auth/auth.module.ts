import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthRateGuard } from './guards/auth-rate.guard.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],

  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthRateGuard, MailService],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
