import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Studio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat/:agentType')
  @ApiOperation({ summary: 'Chat with an AI agent' })
  async chat(
    @Param('agentType') agentType: string,
    @Body('message') message: string,
    @Body('conversationId') conversationId: string,
    @CurrentUser() user: any,
  ) {
    return this.aiService.chat(agentType, message, conversationId, user);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List AI conversations' })
  async getConversations(@CurrentUser() user: any) {
    return this.aiService.getConversations(user.tenantId, user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.aiService.getConversation(user.tenantId, id);
  }

  @Post('generate/product/:productId/description')
  @ApiOperation({ summary: 'Generate AI product description' })
  async generateDescription(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.aiService.generateProductContent(user.tenantId, productId, 'description');
  }

  @Post('generate/product/:productId/caption')
  @ApiOperation({ summary: 'Generate AI social caption for product' })
  async generateCaption(
    @Param('productId') productId: string,
    @Body('platform') platform: string,
    @CurrentUser() user: any,
  ) {
    return this.aiService.generateProductContent(user.tenantId, productId, 'caption', platform);
  }

  @Post('generate/product/:productId/seo')
  @ApiOperation({ summary: 'Generate AI SEO metadata' })
  async generateSeo(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.aiService.generateProductContent(user.tenantId, productId, 'seo');
  }

  @Post('pricing/calculate')
  @ApiOperation({ summary: 'AI-powered pricing calculation' })
  async calculatePricing(@Body() data: any, @CurrentUser() user: any) {
    return this.aiService.calculatePricing(data, user.tenantId);
  }
}
