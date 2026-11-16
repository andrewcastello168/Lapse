import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
export class QueryTimelineDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(['7D', '30D', '3M', '6M', '12M']) window?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit = 500;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) offset = 0;
}
export class ReminderQueryDto {
  @IsOptional() @Type(() => Number) @IsIn([1, 3, 7, 30]) offset = 7;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(23) hour = 9;
}
