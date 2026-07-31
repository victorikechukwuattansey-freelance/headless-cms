import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List products filtered by inventory status' })
  @ApiQuery({ name: 'inventoryStatus', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: 'Products retrieved' })
  async findAll(@CurrentUser() user: any, @Query('inventoryStatus') inventoryStatus?: string) {
    return this.inventoryService.findAll(user.tenantId, inventoryStatus);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.inventoryService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product inventory status' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.inventoryService.updateInventoryStatus(user.tenantId, id, dto, user.id);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Create inventory log and update product' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Inventory adjusted' })
  async adjust(@Body() dto: any, @CurrentUser() user: any) {
    return this.inventoryService.adjust(user.tenantId, dto, user.id);
  }
}
