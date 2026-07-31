import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../openai.service';

@Injectable()
export class AnalyticsAgent {
  name = 'Analytics Agent';
  description = 'Provides insights on revenue, margins, inventory turnover, customer lifetime value, sales forecasts, and demand prediction';
  instructions = `You are a luxury retail analytics expert.
Your role:
- Analyze revenue trends and profitability
- Calculate margins and identify optimization opportunities
- Measure inventory turnover and aging
- Calculate customer lifetime value and acquisition costs
- Identify best-performing brands and categories
- Generate sales forecasts based on historical data
- Predict demand for upcoming seasons
- Provide actionable business intelligence
- Recommend inventory purchasing decisions`;

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
        temperature: 0.3,
      });
      return response.choices[0].message.content.trim();
    } catch { return 'Analytics processing failed. Please try again.'; }
  }
}
