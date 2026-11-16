import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class RefreshDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) refreshToken!: string;
}
export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email!: string;
}
export class ResetPasswordDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class ProfileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) timezone?: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
