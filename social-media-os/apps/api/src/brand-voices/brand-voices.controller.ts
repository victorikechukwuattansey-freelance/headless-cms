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
import { BrandVoicesService } from './brand-voices.service';

@ApiTags('brand-voices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('brand-voices')
export class BrandVoicesController {
  constructor(private brandVoicesService: BrandVoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a brand voice' })
  async create(@Body() data: {
    workspaceId: string;
    name: string;
    personality?: string[];
    audience?: string;
    writingStyle?: string;
    forbiddenWords?: string[];
    approvedTerms?: string[];
    brandColors?: Record<string, string>;
    fonts?: Record<string, string>;
    logoUrl?: string;
  }) {
    return this.brandVoicesService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List brand voices for a workspace' })
  @ApiQuery({ name: 'workspaceId', required: true })
  async findAll(@Query('workspaceId') workspaceId: string) {
    return this.brandVoicesService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand voice by ID' })
  async findOne(@Param('id') id: string) {
    return this.brandVoicesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a brand voice' })
  async update(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      personality?: string[];
      audience?: string;
      writingStyle?: string;
      forbiddenWords?: string[];
      approvedTerms?: string[];
      brandColors?: Record<string, string>;
      fonts?: Record<string, string>;
      logoUrl?: string;
    },
  ) {
    return this.brandVoicesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a brand voice' })
  async remove(@Param('id') id: string) {
    return this.brandVoicesService.remove(id);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate content against brand voice rules' })
  async validateContent(
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.brandVoicesService.validateContent(id, content);
  }
}
