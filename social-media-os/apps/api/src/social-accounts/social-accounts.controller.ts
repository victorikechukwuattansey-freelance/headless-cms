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
import { SocialAccountsService } from './social-accounts.service';

@ApiTags('social-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private socialAccountsService: SocialAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List connected social accounts' })
  @ApiQuery({ name: 'workspaceId', required: true, type: String })
  async findAll(@Query('workspaceId') workspaceId: string) {
    return this.socialAccountsService.findAll(workspaceId);
  }

  @Get('auth-url')
  @ApiOperation({ summary: 'Get OAuth URL for a platform' })
  @ApiQuery({ name: 'platform', required: true, type: String })
  @ApiQuery({ name: 'redirectUri', required: true, type: String })
  async getAuthUrl(
    @Query('platform') platform: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const url = await this.socialAccountsService.getAuthUrl(platform, redirectUri);
    return { url };
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect a social account via OAuth code' })
  async connect(
    @Body() data: { workspaceId: string; platform: string; code: string; redirectUri: string },
  ) {
    return this.socialAccountsService.connect(
      data.workspaceId,
      data.platform,
      data.code,
      data.redirectUri,
    );
  }

  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Disconnect a social account' })
  async disconnect(@Param('id') id: string) {
    return this.socialAccountsService.disconnect(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get social account connection status' })
  async getStatus(@Param('id') id: string) {
    return this.socialAccountsService.getStatus(id);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh OAuth token for social account' })
  async refreshToken(@Param('id') id: string) {
    return this.socialAccountsService.refreshToken(id);
  }
}
