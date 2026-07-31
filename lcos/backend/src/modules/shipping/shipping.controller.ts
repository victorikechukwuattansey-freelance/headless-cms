import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Shipping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shipping record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Shipping record created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.shippingService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all shipping records' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Shipping records retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.shippingService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shipping record by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Shipping record found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Shipping record not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.shippingService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update shipping record' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.shippingService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete shipping record' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Shipping record deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.shippingService.softDelete(user.tenantId, id);
  }
}
