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
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post()
  @ApiOperation({ summary: 'Create a CRM record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'CRM record created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.crmService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all CRM records' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CRM records retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.crmService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get CRM record by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CRM record found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CRM record not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.crmService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update CRM record' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.crmService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete CRM record' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CRM record deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.crmService.softDelete(user.tenantId, id);
  }
}
