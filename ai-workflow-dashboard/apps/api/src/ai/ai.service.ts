import { Injectable } from "@nestjs/common";
import { AiGatewayService } from "@awd/ai-gateway";
import { loadEnv } from "@awd/config";

@Injectable()
export class AiService {
  private readonly gateway: AiGatewayService;

  constructor() {
    const env = loadEnv();
    this.gateway = new AiGatewayService({
      defaultProvider: env.AI_DEFAULT_PROVIDER,
      fallbackProvider: env.AI_FALLBACK_PROVIDER,
      ollamaBaseUrl: env.OLLAMA_BASE_URL,
      ollamaModel: env.OLLAMA_MODEL,
      openaiApiKey: env.OPENAI_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
    });
  }

  get gatewayService(): AiGatewayService {
    return this.gateway;
  }
}

