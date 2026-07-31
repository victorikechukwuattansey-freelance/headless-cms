import { Module, Global } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SalesAgent } from './agents/sales.agent';
import { ContentAgent } from './agents/content.agent';
import { PricingAgent } from './agents/pricing.agent';
import { MarketingAgent } from './agents/marketing.agent';
import { AnalyticsAgent } from './agents/analytics.agent';

@Global()
@Module({
  controllers: [AiController],
  providers: [
    OpenAiService,
    AiService,
    SalesAgent,
    ContentAgent,
    PricingAgent,
    MarketingAgent,
    AnalyticsAgent,
  ],
  exports: [OpenAiService, AiService, SalesAgent, ContentAgent, PricingAgent, MarketingAgent, AnalyticsAgent],
})
export class AiModule {}
