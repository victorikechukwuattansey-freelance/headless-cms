import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../openai.service';

@Injectable()
export class PricingAgent {
  name = 'Pricing Agent';
  description = 'Calculates selling price, profit, margin, markup, currency conversion, and cost analysis';
  instructions = `You are a luxury pricing analyst.
Your role:
- Calculate optimal selling prices based on cost + market data
- Analyze profit margins and markups
- Handle multi-currency conversions
- Factor in import costs, shipping, taxes
- Provide pricing recommendations based on brand, condition, and market demand
- Consider authentication costs and commissions`;

  constructor(private openaiService: OpenAiService) {}

  async process(message: string, conversation: any, user: any): Promise<string> {
    try {
      const openai = (this.openaiService as any).openai;
      if (!openai) return 'AI agent unavailable - configure OPENAI_API_KEY';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: this.instructions },
          { role: 'user', content: message },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });
      return response.choices[0].message.content.trim();
    } catch { return 'Pricing calculation failed. Please try again.'; }
  }

  async calculate(data: any) {
    const purchasePrice = Number(data.purchasePrice) || 0;
    const shippingCost = Number(data.shippingCost) || 0;
    const customsCost = Number(data.customsCost) || 0;
    const restorationCost = Number(data.restorationCost) || 0;
    const commission = Number(data.commission) || 0;
    const targetMargin = Number(data.targetMargin) || 30;

    const totalCost = purchasePrice + shippingCost + customsCost + restorationCost + commission;
    const sellingPrice = totalCost / (1 - targetMargin / 100);
    const profit = sellingPrice - totalCost;
    const markup = totalCost > 0 ? ((sellingPrice - totalCost) / totalCost) * 100 : 0;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      suggestedSellingPrice: Math.round(sellingPrice * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: targetMargin,
      markup: Math.round(markup * 100) / 100,
      breakdown: {
        purchasePrice,
        shippingCost,
        customsCost,
        restorationCost,
        commission,
      },
    };
  }
}
