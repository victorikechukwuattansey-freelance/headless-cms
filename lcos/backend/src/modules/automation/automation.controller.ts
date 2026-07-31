import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { AutomationEngine } from './automation.engine';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly automationEngine: AutomationEngine,
  ) {}

  @Get('workflows')
  @ApiOperation({ summary: 'List all automation workflows' })
  async getWorkflows(@CurrentUser() user: any) {
    return this.automationService.getWorkflows(user.tenantId);
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create automation workflow' })
  async createWorkflow(@Body() body: any, @CurrentUser() user: any) {
    return this.automationService.createWorkflow(user.tenantId, body);
  }

  @Put('workflows/:id')
  @ApiOperation({ summary: 'Update automation workflow' })
  async updateWorkflow(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.automationService.updateWorkflow(user.tenantId, id, body);
  }

  @Delete('workflows/:id')
  @ApiOperation({ summary: 'Delete automation workflow' })
  async deleteWorkflow(@Param('id') id: string, @CurrentUser() user: any) {
    return this.automationService.deleteWorkflow(user.tenantId, id);
  }

  @Post('workflows/:id/toggle')
  @ApiOperation({ summary: 'Toggle workflow active state' })
  async toggleWorkflow(@Param('id') id: string, @CurrentUser() user: any) {
    return this.automationService.toggleWorkflow(user.tenantId, id);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List automation rules' })
  async getRules(@CurrentUser() user: any) {
    return this.automationService.getRules(user.tenantId);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create automation rule' })
  async createRule(@Body() body: any, @CurrentUser() user: any) {
    return this.automationService.createRule(user.tenantId, body);
  }
}
