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
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sale record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Sale created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.salesService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all sales' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sales retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.salesService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sale found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sale not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.salesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sale' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.salesService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete sale' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sale deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.salesService.softDelete(user.tenantId, id);
  }
}
