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
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get()
  @ApiOperation({ summary: 'List all campaigns' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campaigns retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.marketingService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campaign found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Campaign not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketingService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Campaign created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.marketingService.create(user.tenantId, dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.marketingService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a campaign' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campaign deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketingService.softDelete(user.tenantId, id);
  }
}
