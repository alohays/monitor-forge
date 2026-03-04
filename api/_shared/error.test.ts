import { describe, it, expect } from 'vitest';
import { errorResponse, jsonResponse } from './error.js';

describe('errorResponse', () => {
  it('returns Response with correct status', () => {
    const response = errorResponse(404, 'Not found');
    expect(response.status).toBe(404);
  });

  it('returns JSON body with error field', async () => {
    const response = errorResponse(400, 'Bad request');
    const body = await response.json();
    expect(body.error).toBe('Bad request');
  });

  it('includes CORS headers', () => {
    const response = errorResponse(500, 'Error');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('jsonResponse', () => {
  it('returns 200 by default', () => {
    const response = jsonResponse({ data: 'test' });
    expect(response.status).toBe(200);
  });

  it('returns custom status code', () => {
    const response = jsonResponse({ data: 'test' }, 201);
    expect(response.status).toBe(201);
  });

  it('returns JSON body', async () => {
    const response = jsonResponse({ items: [1, 2, 3] });
    const body = await response.json();
    expect(body.items).toEqual([1, 2, 3]);
  });

  it('includes CORS headers', () => {
    const response = jsonResponse({});
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
