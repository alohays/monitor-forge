import type { AIProviderBase, AIRequest, AIResponse, AIProviderConfig } from './providers/provider-base.js';
import { GroqProvider } from './providers/groq.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import type { SourceItem } from '../sources/SourceBase.js';

export interface AIConfig {
  enabled: boolean;
  fallbackChain: string[];
  providers: Record<string, AIProviderConfig>;
  analysis: {
    summarization: boolean;
    entityExtraction: boolean;
    sentimentAnalysis: boolean;
    focalPointDetection: boolean;
    customPrompt?: string;
  };
}

export class AIManager {
  private providers = new Map<string, AIProviderBase>();
  private fallbackChain: string[] = [];
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.fallbackChain = config.fallbackChain;

    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const provider = this.createProvider(name, providerConfig);
      if (provider) this.providers.set(name, provider);
    }
  }

  private createProvider(name: string, config: AIProviderConfig): AIProviderBase | null {
    switch (name) {
      case 'groq': return new GroqProvider(name, config);
      case 'openrouter': return new OpenRouterProvider(name, config);
      default:
        console.warn(`Unknown AI provider: ${name}`);
        return null;
    }
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    if (!this.config.enabled) throw new Error('AI is disabled');

    for (const providerName of this.fallbackChain) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        return await provider.complete(request);
      } catch (err) {
        console.warn(`AI provider "${providerName}" failed:`, err);
        continue;
      }
    }

    throw new Error('All AI providers failed');
  }

  async generateBrief(items: SourceItem[]): Promise<string> {
    if (!this.config.enabled || items.length === 0) return '';

    const headlines = items.slice(0, 20).map(i => `- ${i.title} (${i.source})`).join('\n');
    const customContext = this.config.analysis.customPrompt
      ? `\n\nFocus area: ${this.config.analysis.customPrompt}`
      : '';

    const response = await this.complete({
      systemPrompt: 'You are an intelligence analyst. Provide concise, factual briefings.',
      prompt: `Analyze these recent headlines and provide a brief intelligence summary (3-5 bullet points) highlighting the most significant developments and any emerging patterns:\n\n${headlines}${customContext}`,
      maxTokens: 512,
    });

    return response.content;
  }

  isEnabled(): boolean { return this.config.enabled; }
}
