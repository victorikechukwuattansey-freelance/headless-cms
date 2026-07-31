import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private prisma: PrismaService) {}

  async getWorkflows(tenantId: string) {
    return this.prisma.automationWorkflow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWorkflow(tenantId: string, data: any) {
    return this.prisma.automationWorkflow.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        definition: data.definition,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateWorkflow(tenantId: string, id: string, data: any) {
    return this.prisma.automationWorkflow.updateMany({
      where: { id, tenantId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  async deleteWorkflow(tenantId: string, id: string) {
    return this.prisma.automationWorkflow.deleteMany({
      where: { id, tenantId },
    });
  }

  async toggleWorkflow(tenantId: string, id: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new Error('Workflow not found');

    return this.prisma.automationWorkflow.update({
      where: { id },
      data: { isActive: !workflow.isActive },
    });
  }

  async getRules(tenantId: string) {
    return this.prisma.automation.findMany({
      where: { tenantId },
      include: { rules: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createRule(tenantId: string, data: any) {
    return this.prisma.automation.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        rules: {
          create: data.rules?.map((rule: any, index: number) => ({
            triggerType: rule.triggerType,
            triggerConfig: rule.triggerConfig || {},
            actionType: rule.actionType,
            actionConfig: rule.actionConfig || {},
            conditions: rule.conditions || {},
            sortOrder: index,
          })) || [],
        },
      },
      include: { rules: true },
    });
  }
}
