import { AIProviderBase, type AIRequest, type AIResponse } from './provider-base.js';

export class GroqProvider extends AIProviderBase {
  async complete(request: AIRequest): Promise<AIResponse> {
    const response = await fetch('/api/ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'groq',
        model: this.config.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json() as { content: string; tokens?: number };
    return {
      content: data.content,
      model: this.config.model,
      provider: 'groq',
      tokensUsed: data.tokens,
    };
  }
}
