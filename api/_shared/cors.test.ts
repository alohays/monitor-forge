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

  it('returns * when allowedOrigins includes *', () => {
    const request = new Request('https://app.com', { headers: { Origin: 'https://app.com' } });
    const headers = corsHeaders(request, ['*']);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns matching origin when in list', () => {
    const request = new Request('https://app.com', { headers: { Origin: 'https://app.com' } });
    const headers = corsHeaders(request, ['https://app.com', 'https://other.com']);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.com');
  });

  it('returns null origin when not in list', () => {
    const request = new Request('https://evil.com', { headers: { Origin: 'https://evil.com' } });
    const headers = corsHeaders(request, ['https://app.com']);
    expect(headers['Access-Control-Allow-Origin']).toBe('null');
  });

  it('backward compatible: no args returns *', () => {
    const headers = corsHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
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

  it('passes allowedOrigins to corsHeaders for OPTIONS', () => {
    const request = new Request('https://example.com/api', {
      method: 'OPTIONS',
      headers: { Origin: 'https://myapp.com' },
    });
    const response = handleCors(request, ['https://myapp.com']);
    expect(response).not.toBeNull();
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com');
  });
});
