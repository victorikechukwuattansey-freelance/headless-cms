export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  finishReason: string;
  raw?: unknown;
}

export type AiProviderName = "ollama" | "openai" | "anthropic" | "gemini";

export interface ModelProfile {
  provider: AiProviderName;
  model: string;
  maxContext: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  toolCalling: boolean;
  streaming: boolean;
}

export interface ProviderAdapter {
  readonly name: AiProviderName;
  complete(request: ChatRequest): Promise<ChatResponse>;
}
