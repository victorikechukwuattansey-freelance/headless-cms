import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OpenAiService } from './openai.service';
import { SalesAgent } from './agents/sales.agent';
import { ContentAgent } from './agents/content.agent';
import { PricingAgent } from './agents/pricing.agent';
import { MarketingAgent } from './agents/marketing.agent';
import { AnalyticsAgent } from './agents/analytics.agent';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAiService,
    private salesAgent: SalesAgent,
    private contentAgent: ContentAgent,
    private pricingAgent: PricingAgent,
    private marketingAgent: MarketingAgent,
    private analyticsAgent: AnalyticsAgent,
  ) {}

  async chat(agentType: string, message: string, conversationId: string, user: any) {
    let agent;
    switch (agentType) {
      case 'sales': agent = this.salesAgent; break;
      case 'content': agent = this.contentAgent; break;
      case 'pricing': agent = this.pricingAgent; break;
      case 'marketing': agent = this.marketingAgent; break;
      case 'analytics': agent = this.analyticsAgent; break;
      default: throw new NotFoundException(`Agent type "${agentType}" not found`);
    }

    let conversation;
    if (conversationId) {
      conversation = await this.prisma.aiConversation.findFirst({
        where: { id: conversationId, tenantId: user.tenantId },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
    } else {
      conversation = await this.prisma.aiConversation.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          title: message.slice(0, 100),
          status: 'ACTIVE',
        },
      });
    }

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    const response = await agent.process(message, conversation, user);

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response,
      },
    });

    return { conversationId: conversation.id, response };
  }

  async getConversations(tenantId: string, userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { tenantId, userId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getConversation(tenantId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async generateProductContent(tenantId: string, productId: string, type: string, platform?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { brand: true, category: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    switch (type) {
      case 'description':
        return this.openai.generateProductDescription(product);
      case 'caption':
        return this.openai.generateSocialCaption(product, platform || 'instagram');
      case 'seo':
        return this.generateSeoMetadata(product);
      default:
        throw new NotFoundException(`Content type "${type}" not found`);
    }
  }

  async calculatePricing(data: any, tenantId: string) {
    return this.pricingAgent.calculate(data);
  }

  private async generateSeoMetadata(product: any) {
    if (!this.openai['openai']) return { metaTitle: '', metaDescription: '' };

    try {
      const prompt = `Generate SEO metadata for this luxury product:
Name: ${product.name}
Brand: ${product.brand?.name}
Description: ${product.description || ''}

Return a JSON with:
- metaTitle: under 60 chars
- metaDescription: under 160 chars
- metaKeywords: comma-separated list`;

      const response = await this.openai['openai'].chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      this.logger.error('SEO generation failed', error.message);
      return { metaTitle: product.name, metaDescription: product.description?.slice(0, 160) || '' };
    }
  }
}
