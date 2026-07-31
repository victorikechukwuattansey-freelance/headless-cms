import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import { AIServiceProvider, AIAction } from '@prisma/client';

export class GenerateDto {
  @IsString()
  workspaceId!: string;

  @IsEnum(AIServiceProvider)
  @IsOptional()
  provider?: AIServiceProvider;

  @IsString()
  @IsOptional()
  model?: string;

  @IsEnum(AIAction)
  action!: AIAction;

  @IsString()
  prompt!: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  brandVoiceId?: string;

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
