import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { GenerateDto } from './dto/generate.dto';

interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly ACTION_PROMPTS: Record<string, string> = {
    generate: 'Generate social media content based on the following requirements.',
    repurpose: 'Repurpose the following content for a different social media platform. Adapt the tone, length, and format appropriately.',
    improve: 'Improve the following social media content. Make it more engaging, clear, and effective while preserving the core message.',
    rewrite: 'Rewrite the following content with a fresh perspective. Keep the key message but change the wording and structure.',
    expand: 'Expand the following content into a more detailed post. Add depth, context, and supporting points.',
    summarize: 'Summarize the following content into a concise social media post. Capture the key points in a brief format.',
    translate: 'Translate the following content to the specified language while maintaining social media best practices.',
    analyze: 'Analyze the following content and provide insights on engagement potential, tone, clarity, and suggested improvements.',
  };

  private readonly PLATFORM_GUIDELINES: Record<string, string> = {
    facebook: 'Facebook posts can be up to 63,206 characters. Use a conversational, engaging tone. Include a clear call-to-action. Best for community building and storytelling.',
    instagram: 'Instagram captions can be up to 2,200 characters but best engagement is 125-150 characters. Use emojis, hashtags strategically (3-5 max). Tell a story. Best for visual storytelling.',
    twitter: 'Posts can be up to 25,000 characters but optimal is under 280. Be concise, sharp, and timely. Use 1-2 relevant hashtags. Best for news, thoughts, engagement.',
    linkedin: 'Posts up to 3,000 characters. Professional but personable tone. Lead with insight, share expertise. Use line breaks for readability. Best for thought leadership.',
    tiktok: 'Captions up to 2,200 characters. Short, punchy, trend-aware. Use hooks, emojis. Best for entertainment and trends.',
    threads: 'Posts up to 500 characters. Casual, conversational. Can be part of a thread. Best for real-time updates and discussions.',
    pinterest: 'Pin descriptions up to 500 characters. Descriptive, keyword-rich, actionable. Best for inspiration and ideas.',
    youtube: 'Descriptions up to 5,000 characters. Start with key info, include timestamps, links, CTA. SEO-optimized.',
  };

  constructor(
    private prisma: PrismaService,
    private openaiProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private geminiProvider: GeminiProvider,
    private ollamaProvider: OllamaProvider,
  ) {}

  private getProvider(providerName: string) {
    switch (providerName) {
      case 'OPENAI': return this.openaiProvider;
      case 'ANTHROPIC': return this.anthropicProvider;
      case 'GEMINI': return this.geminiProvider;
      case 'OLLAMA': return this.ollamaProvider;
      default: return this.openaiProvider;
    }
  }

  private getDefaultModel(providerName: string): string {
    switch (providerName) {
      case 'OPENAI': return 'gpt-4o';
      case 'ANTHROPIC': return 'claude-sonnet-4-20250514';
      case 'GEMINI': return 'gemini-1.5-pro';
      case 'OLLAMA': return 'llama3.2';
      default: return 'gpt-4o';
    }
  }

  private buildSystemPrompt(action: string, platform?: string, brandVoice?: any): string {
    const actionPrompt = this.ACTION_PROMPTS[action] || this.ACTION_PROMPTS.generate;
    const platformGuidelines = platform ? this.PLATFORM_GUIDELINES[platform.toLowerCase()] : '';

    let systemPrompt = `You are an expert social media content strategist and copywriter. ${actionPrompt}`;

    if (platformGuidelines) {
      systemPrompt += `\n\nPlatform Guidelines (${platform}):\n${platformGuidelines}`;
    }

    if (brandVoice) {
      systemPrompt += `\n\nBrand Voice Guidelines:\n`;
      systemPrompt += `- Personality: ${brandVoice.personality?.join(', ')}\n`;
      systemPrompt += `- Target Audience: ${brandVoice.audience || 'General'}\n`;
      systemPrompt += `- Writing Style: ${brandVoice.writingStyle || 'Professional'}\n`;
      if (brandVoice.forbiddenWords?.length > 0) {
        systemPrompt += `- NEVER use these forbidden words: ${brandVoice.forbiddenWords.join(', ')}\n`;
      }
      if (brandVoice.approvedTerms?.length > 0) {
        systemPrompt += `- Preferred terminology: ${brandVoice.approvedTerms.join(', ')}\n`;
      }
    }

    return systemPrompt;
  }

  async generate(dto: GenerateDto, userId: string) {
    const startTime = Date.now();
    const provider = dto.provider || 'OPENAI';
    const model = dto.model || this.getDefaultModel(provider);
    const providerInstance = this.getProvider(provider);

    let brandVoice = null;
    if (dto.brandVoiceId) {
      brandVoice = await this.prisma.brandVoice.findUnique({
        where: { id: dto.brandVoiceId },
      });
    }

    const systemPrompt = this.buildSystemPrompt(dto.action, dto.platform, brandVoice);

    let result: { text: string; tokensUsed: number; cost: number; latencyMs: number; model: string };

    try {
      const genResult = await (providerInstance as any).generate(
        dto.prompt,
        systemPrompt,
        model,
      );
      result = genResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      this.logger.error(`AI generation failed: ${message}`);

      try {
        this.logger.log('Attempting fallback to OpenAI');
        const fallback = await this.openaiProvider.generate(dto.prompt, systemPrompt, 'gpt-4o-mini');
        result = fallback;
      } catch (fallbackError) {
        throw new BadRequestException(`AI generation failed: ${message}`);
      }
    }

    const totalLatency = Date.now() - startTime;

    await this.prisma.aIGeneration.create({
      data: {
        workspaceId: dto.workspaceId,
        userId,
        provider: provider as any,
        model: result.model,
        action: dto.action,
        prompt: dto.prompt,
        result: result.text,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        latencyMs: totalLatency,
      },
    });

    return {
      content: result.text,
      model: result.model,
      provider,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      latencyMs: totalLatency,
    };
  }

  async generateWithOptions(
    options: GenerateOptions,
    workspaceId: string,
    userId: string,
  ) {
    return this.generate(
      {
        workspaceId,
        prompt: options.prompt,
        action: 'generate' as any,
        provider: 'OPENAI' as any,
        model: options.model,
      },
      userId,
    );
  }
}
