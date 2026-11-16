import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
export enum ExpiryType {
  ONCE = 'ONCE',
  NEVER = 'NEVER',
  RECURRING = 'RECURRING',
}
export enum RenewalMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}
export class CreateUserItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  miId?: number;
  @ValidateIf((o: CreateUserItemDto) => o.miId == null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  mcId?: number;
  @ValidateIf(
    (o: CreateUserItemDto) => o.miId == null || o.itemName !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemName?: string;
  @IsEnum(ExpiryType) expiryType!: ExpiryType;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  recurrenceYears?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  recurrenceMonths?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  recurrenceDays?: number;
  @ValidateIf((o: CreateUserItemDto) => o.expiryType !== ExpiryType.NEVER)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiryDate?: string;
  @IsOptional() @IsEnum(RenewalMode) renewalMode?: RenewalMode;
}
