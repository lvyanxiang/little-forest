import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  visitDate: string;

  @Type(() => Number)
  @IsInt()
  slotId: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(/^1\d{10}$/)
  phone: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  people: number;
}

export class ListBookingsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
