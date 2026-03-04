import { handleCors } from '../../_shared/cors.js';
import { jsonResponse, errorResponse } from '../../_shared/error.js';

export const config = { runtime: 'edge' };

interface AIRequest {
  provider: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export default async function handler(request: Request): Promise<Response> {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const body = await request.json() as AIRequest;
    const { provider, model, prompt, systemPrompt, maxTokens = 1024, temperature = 0.3 } = body;

    if (!provider || !model || !prompt) {
      return errorResponse(400, 'Missing required fields: provider, model, prompt');
    }

    switch (provider) {
      case 'groq':
        return await handleGroq(model, prompt, systemPrompt, maxTokens, temperature);
      case 'openrouter':
        return await handleOpenRouter(model, prompt, systemPrompt, maxTokens, temperature);
      default:
        return errorResponse(400, `Unknown provider: ${provider}`);
    }
  } catch (err) {
    return errorResponse(500, `AI request failed: ${err}`);
  }
}

async function handleGroq(
  model: string, prompt: string, systemPrompt?: string,
  maxTokens = 1024, temperature = 0.3,
): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return errorResponse(503, 'GROQ_API_KEY not configured');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Groq error ${response.status}: ${err}`);
    throw new Error(`Upstream AI provider error (${response.status})`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens: number };
  };

  return jsonResponse({
    content: data.choices[0]?.message?.content ?? '',
    tokens: data.usage?.total_tokens,
  });
}

async function handleOpenRouter(
  model: string, prompt: string, systemPrompt?: string,
  maxTokens = 1024, temperature = 0.3,
): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return errorResponse(503, 'OPENROUTER_API_KEY not configured');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://monitor-forge.dev',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`OpenRouter error ${response.status}: ${err}`);
    throw new Error(`Upstream AI provider error (${response.status})`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens: number };
  };

  return jsonResponse({
    content: data.choices[0]?.message?.content ?? '',
    tokens: data.usage?.total_tokens,
  });
}