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
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an analytics record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Analytics record created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.analyticsService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all analytics records' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics records retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.analyticsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get analytics record by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics record found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Analytics record not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.analyticsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update analytics record' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.analyticsService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete analytics record' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics record deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.analyticsService.softDelete(user.tenantId, id);
  }
}
