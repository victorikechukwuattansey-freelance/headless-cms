import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsArray,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsUUID() brandId: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() collectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierId?: string;

  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() sku: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() material?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serialNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) shippingCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) customsCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) restorationCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAuthenticated?: boolean;
}
