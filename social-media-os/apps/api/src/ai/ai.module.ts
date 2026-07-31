import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OllamaProvider,
  ],
  exports: [AiService, OpenAIProvider, AnthropicProvider, GeminiProvider, OllamaProvider],
})
export class AiModule {}
