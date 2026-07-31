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
import { WorkflowsService } from './workflows.service';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow' })
  async create(@Body() data: {
    workspaceId: string;
    name: string;
    description?: string;
    trigger: any;
    actions: any[];
  }) {
    return this.workflowsService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows in a workspace' })
  @ApiQuery({ name: 'workspaceId', required: true })
  async findAll(@Query('workspaceId') workspaceId: string) {
    return this.workflowsService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  async findOne(@Param('id') id: string) {
    return this.workflowsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  async update(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      description?: string;
      trigger?: any;
      actions?: any[];
      isActive?: boolean;
    },
  ) {
    return this.workflowsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  async remove(@Param('id') id: string) {
    return this.workflowsService.remove(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a workflow' })
  async execute(@Param('id') id: string) {
    return this.workflowsService.execute(id);
  }
}
