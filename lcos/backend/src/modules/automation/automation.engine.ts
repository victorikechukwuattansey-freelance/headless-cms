import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../../common/event-bus.service';
import { PrismaService } from '../../common/prisma.service';
import { OpenAiService } from '../ai/openai.service';

@Injectable()
export class AutomationEngine implements OnModuleInit {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private eventBus: EventBusService,
    private prisma: PrismaService,
    private openai: OpenAiService,
  ) {}

  onModuleInit() {
    this.registerEventHandlers();
    this.logger.log('Automation engine initialized');
  }

  private registerEventHandlers() {
    const handlers: Record<string, string> = {
      'product.created': 'PRODUCT_CREATED',
      'product.updated': 'PRODUCT_UPDATED',
      'product.status_changed': 'PRODUCT_SOLD',
      'order.created': 'ORDER_CREATED',
      'order.shipped': 'ORDER_SHIPPED',
      'order.delivered': 'ORDER_DELIVERED',
      'payment.received': 'PAYMENT_RECEIVED',
      'lead.created': 'LEAD_CREATED',
      'lead.converted': 'LEAD_CONVERTED',
      'customer.created': 'CUSTOMER_CREATED',
      'inventory.low': 'INVENTORY_LOW',
      'authentication.completed': 'AUTHENTICATION_COMPLETED',
    };

    for (const [event, triggerType] of Object.entries(handlers)) {
      this.eventBus.on(event, async (payload) => {
        await this.evaluateTriggers(triggerType, payload);
      });
    }
  }

  private async evaluateTriggers(triggerType: string, payload: any) {
    try {
      const automations = await this.prisma.automation.findMany({
        where: {
          tenantId: payload.tenantId,
          isActive: true,
          rules: {
            some: {
              triggerType: triggerType as any,
            },
          },
        },
        include: { rules: true },
      });

      for (const automation of automations) {
        for (const rule of automation.rules) {
          if (rule.triggerType === triggerType) {
            await this.executeAction(rule.actionType, rule.actionConfig, payload);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error evaluating triggers: ${error.message}`);
    }
  }

  private async executeAction(actionType: string, config: any, payload: any) {
    this.logger.log(`Executing action: ${actionType}`);

    switch (actionType) {
      case 'GENERATE_AI_DESCRIPTION':
        await this.generateAiDescription(payload);
        break;
      case 'GENERATE_SOCIAL_CAPTION':
        await this.generateSocialCaption(payload, config);
        break;
      case 'SEND_NOTIFICATION':
        await this.sendNotification(payload, config);
        break;
      case 'UPDATE_INVENTORY':
        await this.updateInventory(payload, config);
        break;
      case 'CREATE_TASK':
        await this.createTask(payload, config);
        break;
      default:
        this.logger.warn(`Unknown action type: ${actionType}`);
    }
  }

  private async generateAiDescription(payload: any) {
    if (!payload.product?.id) return;
    try {
      await this.openai.generateProductDescription(payload.product);
    } catch (error) {
      this.logger.error(`AI description generation failed: ${error.message}`);
    }
  }

  private async generateSocialCaption(payload: any, config: any) {
    if (!payload.product?.id) return;
    const platform = config.platform || 'instagram';
    try {
      await this.openai.generateSocialCaption(payload.product, platform);
    } catch (error) {
      this.logger.error(`Social caption generation failed: ${error.message}`);
    }
  }

  private async sendNotification(payload: any, config: any) {
    await this.prisma.notification.create({
      data: {
        tenantId: payload.tenantId,
        type: 'SYSTEM',
        title: config.title || 'Automation Notification',
        message: config.message || 'An automated action was triggered',
        data: payload,
      },
    });
  }

  private async updateInventory(payload: any, config: any) {
    if (!payload.product?.id) return;
    await this.prisma.inventoryLog.create({
      data: {
        productId: payload.product.id,
        tenantId: payload.tenantId,
        newStatus: payload.product.inventoryStatus,
        newQty: payload.product.quantity || 1,
        changedBy: payload.userId || 'system',
        reason: config.reason || 'Automated inventory update',
      },
    });
  }

  private async createTask(payload: any, config: any) {
    await this.prisma.task.create({
      data: {
        tenantId: payload.tenantId,
        title: config.title || 'Automated Task',
        description: config.description || 'Task created by automation engine',
        status: 'PENDING',
        priority: config.priority || 'MEDIUM',
        productId: payload.product?.id,
        customerId: payload.customer?.id,
        leadId: payload.lead?.id,
      },
    });
  }
}
