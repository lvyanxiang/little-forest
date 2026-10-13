import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  IsObject,
  MinLength,
  Max,
  Min,
} from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  quickDateDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  bookingAdvanceDays?: number;

  @IsOptional()
  @IsObject()
  uiText?: Record<string, string>;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  closedWeekdays?: number[];

  @IsOptional()
  @IsString()
  noticeHeading?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noticeItems?: string[];

  @IsOptional()
  @IsString()
  noticeFoot?: string;

  @IsOptional()
  @IsString()
  homeHeroText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successNoticeLines?: string[];
}
