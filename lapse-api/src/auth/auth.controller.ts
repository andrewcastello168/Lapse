import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ProfileDto,
  RefreshDto,
  ResetPasswordDto,
} from './dto/account.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthRateGuard } from './guards/auth-rate.guard.js';
import type { AuthenticatedRequest } from './request.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('signup') @UseGuards(AuthRateGuard) signup(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }
  @Post('login') @UseGuards(AuthRateGuard) login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
  @Post('refresh') refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }
  @Post('logout') logout(@Body() body: RefreshDto) {
    return this.authService.logout(body.refreshToken);
  }
  @Post('forgot-password') @HttpCode(200) @UseGuards(AuthRateGuard) forgot(
    @Body() body: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(body.email);
  }
  @Post('reset-password') @HttpCode(200) @UseGuards(AuthRateGuard) reset(
    @Body() body: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(body.token, body.password);
  }
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() req: AuthenticatedRequest) {
    return this.authService.profile(req.user.sub);
  }
  @Patch('me') @UseGuards(JwtAuthGuard) update(
    @Req() req: AuthenticatedRequest,
    @Body() body: ProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, body);
  }
  @Post('password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AuthRateGuard)
  password(@Req() req: AuthenticatedRequest, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, body);
  }
}
