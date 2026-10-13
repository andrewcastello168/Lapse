import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ExpiryType {
  ONCE = 'ONCE',
  NEVER = 'NEVER',
  RECURRING = 'RECURRING',
}

export class CreateUserItemDto {
  // item dari master (opsional). Kalau kosong berarti item custom
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  miId?: number;

  // wajib kalau item custom (tanpa miId), diabaikan kalau ada miId
  @ValidateIf((o: CreateUserItemDto) => o.miId === undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mcId?: number;

  // wajib kalau item custom, opsional kalau dari master (override nama)
  @ValidateIf(
    (o: CreateUserItemDto) => o.miId === undefined || o.itemName !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemName?: string;

  @IsEnum(ExpiryType)
  expiryType!: ExpiryType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceDays?: number;

  // wajib untuk ONCE dan RECURRING, format YYYY-MM-DD
  @ValidateIf((o: CreateUserItemDto) => o.expiryType !== ExpiryType.NEVER)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expiryDate harus berformat YYYY-MM-DD',
  })
  expiryDate?: string;
}
