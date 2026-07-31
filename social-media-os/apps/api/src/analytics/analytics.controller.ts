import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Ingest an analytics event' })
  async ingestEvent(
    @Body() data: {
      workspaceId: string;
      platform: string;
      eventType: string;
      postId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.analyticsService.ingestEvent(data);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview for a date range' })
  @ApiQuery({ name: 'workspaceId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getOverview(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getOverview(
      workspaceId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('platform/:platform')
  @ApiOperation({ summary: 'Get analytics for a specific platform' })
  @ApiQuery({ name: 'workspaceId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getPlatformMetrics(
    @Param('platform') platform: string,
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getPlatformMetrics(
      workspaceId,
      platform,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI-powered analytics insights' })
  @ApiQuery({ name: 'workspaceId', required: true })
  async getInsights(@Query('workspaceId') workspaceId: string) {
    return this.analyticsService.getInsights(workspaceId);
  }
}
