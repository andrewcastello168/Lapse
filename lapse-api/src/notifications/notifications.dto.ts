import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class NotificationPreferencesDto {
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn([0, 1, 3, 7, 14, 30], { each: true })
  offsets!: number[];
  @IsInt() @Min(0) @Max(23) hour!: number;
  @IsString() @MaxLength(100) timezone!: string;
}
export class DeviceDto {
  @IsUUID() id!: string;
  @IsString()
  @MaxLength(255)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
  token!: string;
  @IsBoolean() enabled!: boolean;
}
export class ItemNotificationDto {
  @IsIn(['INHERIT', 'OVERRIDE', 'DISABLED']) mode!: string;
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn([0, 1, 3, 7, 14, 30], { each: true })
  offsets!: number[];
}
export class ReadNotificationDto {
  @IsOptional() @IsString() @MaxLength(255) id?: string;
}
