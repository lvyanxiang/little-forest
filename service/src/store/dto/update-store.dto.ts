import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  hours?: string;

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
  homeNoticeText?: string;

  @IsOptional()
  @IsString()
  homeHeroText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successNoticeLines?: string[];
}
