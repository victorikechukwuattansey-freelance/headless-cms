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
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Supplier created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.suppliersService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all suppliers' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Suppliers retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.suppliersService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Supplier found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Supplier not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update supplier' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.suppliersService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete supplier' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Supplier deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.softDelete(user.tenantId, id);
  }
}
