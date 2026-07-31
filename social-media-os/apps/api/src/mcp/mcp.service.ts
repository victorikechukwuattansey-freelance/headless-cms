import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    url: string;
    apiKey?: string;
  }) {
    const server = await this.prisma.mCPServer.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description || null,
        url: data.url,
        apiKey: data.apiKey || null,
      },
    });

    await this.discoverTools(server.id);

    return this.prisma.mCPServer.findUnique({ where: { id: server.id } });
  }

  async findAll(workspaceId: string) {
    return this.prisma.mCPServer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const server = await this.prisma.mCPServer.findUnique({ where: { id } });
    if (!server) throw new NotFoundException('MCP server not found');
    return server;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    url?: string;
    apiKey?: string;
    isConnected?: boolean;
  }) {
    await this.findById(id);
    return this.prisma.mCPServer.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.mCPServer.delete({ where: { id } });
  }

  async discoverTools(serverId: string) {
    const server = await this.findById(serverId);

    try {
      const response = await fetch(`${server.url}/tools`, {
        headers: server.apiKey
          ? { Authorization: `Bearer ${server.apiKey}` }
          : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to discover tools: ${response.statusText}`);
      }

      const toolsData = await response.json();
      const tools: MCPToolDefinition[] = toolsData.tools || toolsData || [];

      await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: {
          tools: tools,
          isConnected: true,
        },
      });

      this.logger.log(`Discovered ${tools.length} tools from MCP server ${server.name}`);

      return tools;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Discovery failed';
      this.logger.error(`MCP tool discovery failed for ${server.name}: ${message}`);

      await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: { isConnected: false },
      });

      throw new Error(`Failed to connect to MCP server: ${message}`);
    }
  }

  async executeTool(serverId: string, toolName: string, parameters: Record<string, unknown>): Promise<MCPToolResult> {
    const server = await this.findById(serverId);

    const tools = server.tools as unknown as MCPToolDefinition[];
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new NotFoundException(`Tool "${toolName}" not found on MCP server`);
    }

    try {
      const response = await fetch(`${server.url}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(server.apiKey ? { Authorization: `Bearer ${server.apiKey}` } : {}),
        },
        body: JSON.stringify({
          tool: toolName,
          parameters,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `MCP execution failed: ${response.status} - ${errorBody}`,
        };
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed';
      return { success: false, error: message };
    }
  }
}
