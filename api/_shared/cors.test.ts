import { describe, it, expect } from 'vitest';
import { corsHeaders, handleCors } from './cors.js';

describe('corsHeaders', () => {
  it('returns all required CORS headers', () => {
    const headers = corsHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });
});

describe('handleCors', () => {
  it('returns 204 Response for OPTIONS request', () => {
    const request = new Request('https://example.com/api', { method: 'OPTIONS' });
    const response = handleCors(request);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(204);
  });

  it('returns null for GET request', () => {
    const request = new Request('https://example.com/api', { method: 'GET' });
    expect(handleCors(request)).toBeNull();
  });

  it('returns null for POST request', () => {
    const request = new Request('https://example.com/api', { method: 'POST' });
    expect(handleCors(request)).toBeNull();
  });
});
