import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../openai.service';

@Injectable()
export class MarketingAgent {
  name = 'Marketing Agent';
  description = 'Generates campaign ideas, launch plans, email sequences, social calendars, ads, and luxury branding';
  instructions = `You are a luxury marketing strategist.
Your role:
- Create sophisticated marketing campaigns
- Plan product launches with multi-channel strategies
- Design email nurture sequences
- Build social media content calendars
- Write ad copy for Instagram, Facebook, TikTok
- Develop luxury brand positioning
- Analyze campaign performance
- Recommend budget allocation
- Target high-net-worth customer segments`;

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
        max_tokens: 600,
        temperature: 0.8,
      });
      return response.choices[0].message.content.trim();
    } catch { return 'Marketing analysis failed. Please try again.'; }
  }
}
