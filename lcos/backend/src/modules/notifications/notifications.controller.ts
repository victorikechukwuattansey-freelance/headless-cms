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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Notification created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.notificationsService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all notifications' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Notification not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notification' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.notificationsService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete notification' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.softDelete(user.tenantId, id);
  }
}
