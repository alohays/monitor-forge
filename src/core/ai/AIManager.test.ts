import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIManager, type AIConfig } from './AIManager.js';
import type { SourceItem } from '../sources/SourceBase.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeAIConfig(overrides?: Partial<AIConfig>): AIConfig {
  return {
    enabled: true,
    fallbackChain: ['groq'],
    providers: {
      groq: { model: 'llama-3.3', apiKeyEnv: 'GROQ_API_KEY' },
    },
    analysis: {
      summarization: true,
      entityExtraction: true,
      sentimentAnalysis: true,
      focalPointDetection: false,
    },
    ...overrides,
  };
}

function makeItems(count: number): SourceItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Headline ${i}`,
    url: `https://example.com/${i}`,
    source: 'test',
    category: 'news',
    timestamp: new Date(),
  }));
}

describe('AIManager', () => {
  it('isEnabled returns config.enabled', () => {
    const manager = new AIManager(makeAIConfig({ enabled: false }));
    expect(manager.isEnabled()).toBe(false);

    const enabled = new AIManager(makeAIConfig({ enabled: true }));
    expect(enabled.isEnabled()).toBe(true);
  });

  it('throws when AI is disabled', async () => {
    const manager = new AIManager(makeAIConfig({ enabled: false }));
    await expect(manager.complete({ prompt: 'test' })).rejects.toThrow('AI is disabled');
  });

  it('completes request using first provider in chain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ content: 'AI response', tokens: 10 }), { status: 200 }),
    );
    const manager = new AIManager(makeAIConfig());
    const response = await manager.complete({ prompt: 'test' });
    expect(response.content).toBe('AI response');
    expect(response.provider).toBe('groq');
  });

  it('falls back to next provider on failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: 'Fallback', tokens: 5 }), { status: 200 }),
      );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new AIManager(makeAIConfig({
      fallbackChain: ['groq', 'openrouter'],
      providers: {
        groq: { model: 'llama', apiKeyEnv: 'GROQ_KEY' },
        openrouter: { model: 'llama', apiKeyEnv: 'OR_KEY' },
      },
    }));
    const response = await manager.complete({ prompt: 'test' });
    expect(response.content).toBe('Fallback');
    expect(response.provider).toBe('openrouter');
    warnSpy.mockRestore();
  });

  it('throws when all providers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('All down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const manager = new AIManager(makeAIConfig());
    await expect(manager.complete({ prompt: 'test' })).rejects.toThrow('All AI providers failed');
    warnSpy.mockRestore();
  });

  it('generateBrief returns empty string when no items', async () => {
    const manager = new AIManager(makeAIConfig());
    const brief = await manager.generateBrief([]);
    expect(brief).toBe('');
  });

  it('generateBrief returns empty string when disabled', async () => {
    const manager = new AIManager(makeAIConfig({ enabled: false }));
    const brief = await manager.generateBrief(makeItems(5));
    expect(brief).toBe('');
  });

  it('generateBrief produces summary from items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ content: 'Summary of events', tokens: 100 }), { status: 200 }),
    );
    const manager = new AIManager(makeAIConfig());
    const brief = await manager.generateBrief(makeItems(5));
    expect(brief).toBe('Summary of events');
  });
});
