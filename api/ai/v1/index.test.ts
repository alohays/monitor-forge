import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './index.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.com/api/ai/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('ai/v1 handler', () => {
  it('returns 204 for OPTIONS', async () => {
    const request = new Request('https://example.com/api/ai/v1', { method: 'OPTIONS' });
    const response = await handler(request);
    expect(response.status).toBe(204);
  });

  it('returns 405 for GET requests', async () => {
    const request = new Request('https://example.com/api/ai/v1');
    const response = await handler(request);
    expect(response.status).toBe(405);
  });

  it('returns 400 when provider missing', async () => {
    const request = makePostRequest({ model: 'm', prompt: 'p' });
    const response = await handler(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when model missing', async () => {
    const request = makePostRequest({ provider: 'groq', prompt: 'p' });
    const response = await handler(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when prompt missing', async () => {
    const request = makePostRequest({ provider: 'groq', model: 'm' });
    const response = await handler(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for unknown provider', async () => {
    const request = makePostRequest({ provider: 'unknown', model: 'm', prompt: 'p' });
    const response = await handler(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Unknown provider');
  });

  it('returns 503 when GROQ_API_KEY not set', async () => {
    delete process.env.GROQ_API_KEY;
    const request = makePostRequest({ provider: 'groq', model: 'm', prompt: 'p' });
    const response = await handler(request);
    expect(response.status).toBe(503);
  });

  it('forwards request to Groq and returns response', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'AI response' } }],
        usage: { total_tokens: 50 },
      }), { status: 200 }),
    );

    const request = makePostRequest({ provider: 'groq', model: 'llama', prompt: 'Hello' });
    const response = await handler(request);
    expect(response.status).toBe(200);
    const body = await response.json() as { content: string; tokens: number };
    expect(body.content).toBe('AI response');
    expect(body.tokens).toBe(50);

    delete process.env.GROQ_API_KEY;
  });

  it('forwards request to OpenRouter and returns response', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'OR response' } }],
        usage: { total_tokens: 100 },
      }), { status: 200 }),
    );

    const request = makePostRequest({ provider: 'openrouter', model: 'meta-llama', prompt: 'Hello' });
    const response = await handler(request);
    expect(response.status).toBe(200);
    const body = await response.json() as { content: string };
    expect(body.content).toBe('OR response');

    delete process.env.OPENROUTER_API_KEY;
  });

  // ─── Input Validation Edge Cases ──────────────────────────

  describe('input validation edge cases', () => {
    it('returns 500 for invalid JSON body', async () => {
      const request = new Request('https://example.com/api/ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });
      const response = await handler(request);
      expect(response.status).toBe(500);
    });

    it('handles empty string prompt as missing', async () => {
      const request = makePostRequest({ provider: 'groq', model: 'm', prompt: '' });
      const response = await handler(request);
      expect(response.status).toBe(400);
    });

    it('handles response with empty choices array gracefully', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [], usage: { total_tokens: 0 } }), { status: 200 }),
      );
      const request = makePostRequest({ provider: 'groq', model: 'm', prompt: 'test' });
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { content: string };
      expect(body.content).toBe(''); // graceful fallback to empty string
      delete process.env.GROQ_API_KEY;
    });

    it('never exposes API key in error responses', async () => {
      const testKey = 'sk-super-secret-key-12345';
      process.env.GROQ_API_KEY = testKey;
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('API error'));
      const request = makePostRequest({ provider: 'groq', model: 'm', prompt: 'test' });
      const response = await handler(request);
      const body = await response.text();
      expect(body).not.toContain(testKey);
      delete process.env.GROQ_API_KEY;
    });

    it('handles upstream non-OK response without leaking details', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Rate limit exceeded: quota=100, used=101, plan=free', { status: 429 }),
      );
      const request = makePostRequest({ provider: 'groq', model: 'm', prompt: 'test' });
      const response = await handler(request);
      expect(response.status).toBe(500);
      const body = await response.json() as { error: string };
      expect(body.error).not.toContain('Rate limit');
      expect(body.error).not.toContain('quota');
      expect(body.error).toContain('AI request failed');
      delete process.env.GROQ_API_KEY;
    });

    it('sends systemPrompt as system role message when provided', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
      );
      const request = makePostRequest({
        provider: 'groq', model: 'm', prompt: 'test',
        systemPrompt: 'You are an analyst.',
      });
      await handler(request);

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(sentBody.messages[0]).toEqual({ role: 'system', content: 'You are an analyst.' });
      expect(sentBody.messages[1]).toEqual({ role: 'user', content: 'test' });
      delete process.env.GROQ_API_KEY;
    });
  });
});
