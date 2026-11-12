import { PickType } from '@nestjs/mapped-types';
import { CreateUserItemDto } from './create-user-item.dto.js';

// Editing in the reference only changes expiration, never item identity/category.
export class UpdateUserItemDto extends PickType(CreateUserItemDto, [
  'expiryType',
  'expiryDate',
  'recurrenceYears',
  'recurrenceMonths',
  'recurrenceDays',
] as const) {}
