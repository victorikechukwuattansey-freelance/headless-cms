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
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an integration' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Integration created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.integrationsService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all integrations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integrations retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.integrationsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integration found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Integration not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.integrationsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update integration' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.integrationsService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete integration' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integration deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.integrationsService.softDelete(user.tenantId, id);
  }
}
