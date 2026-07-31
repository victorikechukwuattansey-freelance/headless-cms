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
import { McpService } from './mcp.service';

@ApiTags('mcp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(private mcpService: McpService) {}

  @Post()
  @ApiOperation({ summary: 'Register an MCP server' })
  async create(@Body() data: {
    workspaceId: string;
    name: string;
    description?: string;
    url: string;
    apiKey?: string;
  }) {
    return this.mcpService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List MCP servers in a workspace' })
  @ApiQuery({ name: 'workspaceId', required: true })
  async findAll(@Query('workspaceId') workspaceId: string) {
    return this.mcpService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get MCP server by ID' })
  async findOne(@Param('id') id: string) {
    return this.mcpService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an MCP server' })
  async update(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      description?: string;
      url?: string;
      apiKey?: string;
      isConnected?: boolean;
    },
  ) {
    return this.mcpService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an MCP server' })
  async remove(@Param('id') id: string) {
    return this.mcpService.remove(id);
  }

  @Post(':id/discover')
  @ApiOperation({ summary: 'Discover tools from MCP server' })
  async discoverTools(@Param('id') id: string) {
    return this.mcpService.discoverTools(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a tool on MCP server' })
  async executeTool(
    @Param('id') id: string,
    @Body() data: { toolName: string; parameters: Record<string, unknown> },
  ) {
    return this.mcpService.executeTool(id, data.toolName, data.parameters);
  }
}
