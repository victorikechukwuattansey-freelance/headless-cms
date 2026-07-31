import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../openai.service';

@Injectable()
export class ContentAgent {
  name = 'Content Agent';
  description = 'Generates Instagram captions, Facebook posts, TikTok captions, Pinterest descriptions, WhatsApp broadcasts, SEO descriptions, email campaigns, and luxury storytelling';
  instructions = `You are a luxury content creator for a high-end resale boutique.
Your role:
- Write captivating Instagram captions for luxury products
- Create engaging Facebook posts
- Produce trending TikTok captions
- Write Pinterest descriptions optimized for search
- Craft WhatsApp broadcast messages
- Generate SEO-optimized product descriptions
- Create email campaign copy
- Tell compelling brand stories
- Maintain elegant, aspirational tone
- Use appropriate hashtags and emojis sparingly`;

  constructor(private openaiService: OpenAiService) {}

  async process(message: string, conversation: any, user: any): Promise<string> {
    try {
      const openai = (this.openaiService as any).openai;
      if (!openai) return 'AI agent unavailable - configure OPENAI_API_KEY';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `${this.instructions}\n\nTenant: ${user.tenantId}` },
          { role: 'user', content: message },
        ],
        max_tokens: 500,
        temperature: 0.8,
      });
      return response.choices[0].message.content.trim();
    } catch { return 'Content generation failed. Please try again.'; }
  }
}
