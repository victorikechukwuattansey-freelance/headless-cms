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
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @ApiOperation({ summary: 'Create an activity log' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Activity log created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.activityService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all activity logs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Activity logs retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.activityService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity log by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Activity log found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Activity log not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.activityService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update activity log' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.activityService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete activity log' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Activity log deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.activityService.softDelete(user.tenantId, id);
  }
}
