import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    trigger: any;
    actions: any[];
  }) {
    return this.prisma.workflow.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description || null,
        trigger: data.trigger,
        actions: data.actions,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.workflow.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      trigger?: any;
      actions?: any[];
      isActive?: boolean;
    },
  ) {
    await this.findById(id);
    return this.prisma.workflow.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.workflow.delete({ where: { id } });
  }

  async execute(id: string) {
    const workflow = await this.findById(id);

    if (!workflow.isActive) {
      throw new Error('Workflow is not active');
    }

    const triggerConfig = workflow.trigger as { type: string; config: Record<string, unknown> };
    const actions = workflow.actions as Array<{ type: string; config: Record<string, unknown>; order: number }>;

    const executionLog = {
      workflowId: id,
      trigger: triggerConfig,
      actions: [] as Array<{ action: string; status: string; result?: string; error?: string }>,
      startedAt: new Date(),
      completedAt: null as Date | null,
      status: 'running',
    };

    for (const action of actions.sort((a, b) => a.order - b.order)) {
      try {
        this.logger.log(`Executing workflow action: ${action.type} (order: ${action.order})`);

        switch (action.type) {
          case 'publish_post':
            executionLog.actions.push({
              action: action.type,
              status: 'executed',
              result: `Would publish post with config: ${JSON.stringify(action.config)}`,
            });
            break;
          case 'generate_content':
            executionLog.actions.push({
              action: action.type,
              status: 'executed',
              result: `Would generate content with config: ${JSON.stringify(action.config)}`,
            });
            break;
          case 'send_notification':
            executionLog.actions.push({
              action: action.type,
              status: 'executed',
              result: `Would send notification with config: ${JSON.stringify(action.config)}`,
            });
            break;
          default:
            executionLog.actions.push({
              action: action.type,
              status: 'unknown',
              result: `Unknown action type: ${action.type}`,
            });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed';
        executionLog.actions.push({
          action: action.type,
          status: 'failed',
          error: message,
        });
      }
    }

    executionLog.completedAt = new Date();
    executionLog.status = executionLog.actions.some((a) => a.status === 'failed')
      ? 'completed_with_errors'
      : 'completed';

    await this.prisma.workflow.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    this.logger.log(`Workflow ${id} execution completed with status: ${executionLog.status}`);

    return executionLog;
  }

  async evaluateTriggers(workspaceId: string, eventType: string, eventData: Record<string, unknown>) {
    const workflows = await this.prisma.workflow.findMany({
      where: { workspaceId, isActive: true },
    });

    const triggered: string[] = [];

    for (const workflow of workflows) {
      const trigger = workflow.trigger as { type: string; config: Record<string, unknown> };
      if (trigger.type === 'event' && trigger.config.eventType === eventType) {
        triggered.push(workflow.id);
        await this.execute(workflow.id);
      }
    }

    return { triggered };
  }
}
