import { Matches } from 'class-validator';
export class RenewUserItemDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) expected_expiry_date!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) new_expiry_date!: string;
}
