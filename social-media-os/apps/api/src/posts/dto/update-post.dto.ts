import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { PostType, PostStatus, Platform } from '@prisma/client';

export class UpdatePostDto {
  @IsObject()
  @IsOptional()
  content?: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaUrls?: string[];

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;

  @IsArray()
  @IsEnum(Platform, { each: true })
  @IsOptional()
  platforms?: Platform[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}
