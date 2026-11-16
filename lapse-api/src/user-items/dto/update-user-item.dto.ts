import { PartialType, PickType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { CreateUserItemDto } from './create-user-item.dto.js';
export class UpdateUserItemDto extends PartialType(
  PickType(CreateUserItemDto, [
    'expiryType',
    'expiryDate',
    'recurrenceYears',
    'recurrenceMonths',
    'recurrenceDays',
    'renewalMode',
    'itemName',
    'mcId',
  ] as const),
) {
  @IsOptional() @IsBoolean() resetConfirmation?: boolean;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedRenewedThrough?: string;
}
