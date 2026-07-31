import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private openai: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      try {
        const OpenAI = require('openai');
        this.openai = new OpenAI({ apiKey });
      } catch {
        this.logger.warn('OpenAI package not available, AI features disabled');
      }
    } else {
      this.logger.warn('OPENAI_API_KEY not set, AI features disabled');
    }
  }

  async generateProductDescription(product: any): Promise<string> {
    if (!this.openai) return 'AI description unavailable - configure OPENAI_API_KEY';

    try {
      const prompt = `Write a luxury product description for a ${product.condition} ${product.brand?.name || 'luxury'} item.
Product: ${product.name}
Brand: ${product.brand?.name || 'Unknown'}
Condition: ${product.condition}
Color: ${product.color || 'N/A'}
Material: ${product.material || 'N/A'}
Size: ${product.size || 'N/A'}

Write a compelling, elegant description suitable for a luxury resale marketplace. Include condition details, craftsmanship notes, and styling suggestions. Keep it under 200 words.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      this.logger.error('Failed to generate product description', error.message);
      return 'Failed to generate AI description.';
    }
  }

  async generateProductTags(product: any): Promise<string[]> {
    if (!this.openai) return [];

    try {
      const prompt = `Generate 10-15 search tags for this luxury product:
Name: ${product.name}
Brand: ${product.brand?.name || 'Unknown'}
Category: ${product.category?.name || 'Unknown'}
Condition: ${product.condition}
Color: ${product.color || 'N/A'}
Material: ${product.material || 'N/A'}

Return as a comma-separated list of tags. Include brand, category, condition, color, material, and relevant luxury keywords.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      });

      const text = response.choices[0].message.content.trim();
      return text.split(',').map((t: string) => t.trim().toLowerCase());
    } catch (error) {
      this.logger.error('Failed to generate product tags', error.message);
      return [];
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) return [];

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error.message);
      return [];
    }
  }

  async generateSocialCaption(product: any, platform: string): Promise<string> {
    if (!this.openai) return '';

    const platformStyles: Record<string, string> = {
      instagram: 'Engaging, visual-first with emojis and hashtags. Luxury aesthetic.',
      facebook: 'Professional and descriptive. Community-focused tone.',
      tiktok: 'Short, trendy, hook-driven. Use relevant trending hashtags.',
      pinterest: 'Keyword-rich, aspirational, save-worthy description.',
      whatsapp: 'Direct, personal, conversational. Limited to broadcast format.',
    };

    try {
      const prompt = `Write a ${platform} caption for this luxury item:
Product: ${product.name}
Brand: ${product.brand?.name || 'Unknown'}
Price: $${product.sellingPrice || 'N/A'}
Condition: ${product.condition}
Description: ${product.description || product.aiDescription || ''}

Style: ${platformStyles[platform] || 'Luxury, elegant, concise'}
Keep it under 150 words. Include 5-8 relevant hashtags.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      this.logger.error('Failed to generate social caption', error.message);
      return '';
    }
  }
}
