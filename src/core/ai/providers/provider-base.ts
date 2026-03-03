export interface AIProviderConfig {
  model: string;
  apiKeyEnv: string;
  baseUrl?: string;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
}

export abstract class AIProviderBase {
  protected config: AIProviderConfig;
  protected name: string;

  constructor(name: string, config: AIProviderConfig) {
    this.name = name;
    this.config = config;
  }

  abstract complete(request: AIRequest): Promise<AIResponse>;

  isAvailable(): boolean {
    // Check if API key env var is set (at runtime via import.meta.env or process.env)
    return true; // Availability checked at request time
  }

  getName(): string { return this.name; }
  getModel(): string { return this.config.model; }
}
