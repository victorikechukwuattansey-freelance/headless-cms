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
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an asset' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Asset created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.assetsService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all assets' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Assets retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.assetsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asset found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Asset not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.assetsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.assetsService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete asset' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asset deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.assetsService.softDelete(user.tenantId, id);
  }
}
