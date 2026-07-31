import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  async create(@Body() data: {
    workspaceId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    platforms: string[];
  }) {
    return this.campaignsService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns in a workspace' })
  @ApiQuery({ name: 'workspaceId', required: true })
  async findAll(@Query('workspaceId') workspaceId: string) {
    return this.campaignsService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  async update(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      platforms?: string[];
      status?: string;
    },
  ) {
    return this.campaignsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  async remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update campaign status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.campaignsService.updateStatus(id, status);
  }
}
