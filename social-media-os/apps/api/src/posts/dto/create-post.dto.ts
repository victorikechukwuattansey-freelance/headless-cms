import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { PostType, Platform } from '@prisma/client';

export class CreatePostDto {
  @IsString()
  workspaceId!: string;

  @IsObject()
  content!: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaUrls?: string[];

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms!: Platform[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}
