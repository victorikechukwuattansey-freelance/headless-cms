import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { OpenAiService } from '../openai.service';

@Injectable()
export class SalesAgent extends BaseAgent {
  name = 'Luxury Sales Agent';
  description = 'Recommends products, upsells, cross-sells, negotiates, generates invoices, and books appointments';
  instructions = `You are a luxury sales consultant for a high-end resale boutique.
Your role:
- Recommend products based on customer preferences
- Upsell and cross-sell complementary luxury items
- Answer questions about product authenticity, condition, and value
- Handle price negotiations professionally
- Generate invoices and quotes
- Book appointments for VIP clients
- Maintain white-glove service standards
- Use sophisticated, knowledgeable language befitting luxury retail`;

  constructor(private openaiService: OpenAiService) { super(); }

  async process(message: string, conversation: any, user: any): Promise<string> {
    try {
      const openai = (this.openaiService as any).openai;
      if (!openai) return 'AI agent unavailable - configure OPENAI_API_KEY';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `${this.instructions}\n\nTenant context: ${user.tenantId}` },
          { role: 'user', content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      return 'I apologize, but I encountered an error. Please try again or contact support.';
    }
  }
}
