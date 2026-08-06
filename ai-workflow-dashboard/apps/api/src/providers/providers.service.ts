import { Injectable } from "@nestjs/common";
import { loadEnv } from "@awd/config";
import type { AiProviderName } from "@awd/ai-gateway";

const KNOWN_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  anthropic: ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

export interface ProviderStatus {
  name: string;
  configured: boolean;
  healthy: boolean | null;
  models: string[];
  isDefault: boolean;
  isFallback: boolean;
}

@Injectable()
export class ProvidersService {
  async list(): Promise<ProviderStatus[]> {
    const env = loadEnv();
    const names: AiProviderName[] = ["ollama", "openai", "anthropic", "gemini"];
    const result: ProviderStatus[] = [];
    for (const name of names) {
      let configured = false;
      let healthy: boolean | null = null;
      let models: string[] = [];

      if (name === "ollama") {
        configured = true;
        try {
          const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { models?: Array<{ name: string }> };
          healthy = true;
          models = (body.models ?? []).map((m) => m.name);
        } catch {
          healthy = false;
        }
      } else {
        const apiKey =
          name === "openai" ? env.OPENAI_API_KEY
          : name === "anthropic" ? env.ANTHROPIC_API_KEY
          : env.GEMINI_API_KEY;
        configured = !!apiKey;
        healthy = configured;
        models = KNOWN_MODELS[name] ?? [];
      }

      result.push({
        name,
        configured,
        healthy,
        models,
        isDefault: name === env.AI_DEFAULT_PROVIDER,
        isFallback: name === env.AI_FALLBACK_PROVIDER,
      });
    }
    return result;
  }
}
