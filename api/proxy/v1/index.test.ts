import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../_shared/proxy-allowlist.js', () => ({
  PROXY_ALLOWED_DOMAINS: ['feeds.bbci.co.uk'],
  CORS_ALLOWED_ORIGINS: ['*'],
}));

import handler from './index.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('proxy/v1 handler', () => {
  it('returns 204 for OPTIONS', async () => {
    const request = new Request('https://example.com/api/proxy/v1?url=x', { method: 'OPTIONS' });
    const response = await handler(request);
    expect(response.status).toBe(204);
  });

  it('returns 400 when url param missing', async () => {
    const request = new Request('https://example.com/api/proxy/v1');
    const response = await handler(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('url');
  });

  it('returns 403 for private IP 127.0.0.1', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    const request = new Request('https://example.com/api/proxy/v1?url=http://127.0.0.1/secret');
    const response = await handler(request);
    expect(response.status).toBe(403);
  });

  it('returns 403 for private IP 10.x.x.x', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    const request = new Request('https://example.com/api/proxy/v1?url=http://10.0.0.1/internal');
    const response = await handler(request);
    expect(response.status).toBe(403);
  });

  it('returns 403 for private IP 192.168.x.x', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    const request = new Request('https://example.com/api/proxy/v1?url=http://192.168.1.1/router');
    const response = await handler(request);
    expect(response.status).toBe(403);
  });

  it('returns 403 for localhost', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    const request = new Request('https://example.com/api/proxy/v1?url=http://localhost/admin');
    const response = await handler(request);
    expect(response.status).toBe(403);
  });

  it('proxies JSON response correctly when PROXY_ALLOW_ALL is set', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const request = new Request('https://example.com/api/proxy/v1?url=https://api.external.com/data');
    const response = await handler(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBe('test');
  });

  it('returns 502 when upstream fails', async () => {
    process.env.PROXY_ALLOW_ALL = 'true';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));
    // Use a unique URL to avoid cache hit from prior tests
    const request = new Request('https://example.com/api/proxy/v1?url=https://api.external.com/fail-data');
    const response = await handler(request);
    expect(response.status).toBe(502);
  });

  afterEach(() => {
    delete process.env.PROXY_ALLOW_ALL;
  });

  // ─── Domain Allowlist Enforcement ──────────────────────────

  describe('domain allowlist enforcement', () => {
    it('returns 403 for domain not in allowlist', async () => {
      // Default allowlist is empty, PROXY_ALLOW_ALL is not set
      const request = new Request('https://example.com/api/proxy/v1?url=https://evil.com/data');
      const response = await handler(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('allowlist');
    });

    it('allows domain when PROXY_ALLOW_ALL=true', async () => {
      process.env.PROXY_ALLOW_ALL = 'true';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const request = new Request('https://example.com/api/proxy/v1?url=https://any-domain.com/data');
      const response = await handler(request);
      expect(response.status).toBe(200);
    });

    afterEach(() => {
      delete process.env.PROXY_ALLOW_ALL;
    });
  });

  // ─── SSRF Bypass Vector Tests ─────────────────────────────

  describe('SSRF bypass vectors', () => {
    beforeEach(() => {
      process.env.PROXY_ALLOW_ALL = 'true';
    });

    afterEach(() => {
      delete process.env.PROXY_ALLOW_ALL;
    });

    it('blocks 0.0.0.0 (all interfaces)', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=http://0.0.0.0/');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('blocks ::1 (IPv6 loopback)', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=http://[::1]/');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('blocks ::ffff:127.0.0.1 (IPv6-mapped IPv4)', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=http://[::ffff:127.0.0.1]/');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('blocks 169.254.x.x (link-local)', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=http://169.254.169.254/latest/meta-data/');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('blocks 172.16.x.x through 172.31.x.x', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=http://172.16.0.1/');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('rejects file:// protocol', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=file:///etc/passwd');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('rejects ftp:// protocol', async () => {
      const request = new Request('https://example.com/api/proxy/v1?url=ftp://internal.server/data');
      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('rejects javascript: protocol', async () => {
      // URL constructor won't parse this, so it should cause a 502/error
      const request = new Request('https://example.com/api/proxy/v1?url=javascript:alert(1)');
      const response = await handler(request);
      // Should get rejected (502 from URL parse error is acceptable)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it.each([
      'fc00::1',
      'fd12::1',
      'fe80::1',
      'fea0::1',
    ])('blocks IPv6 ULA/link-local %s', async (ip) => {
      const request = new Request(`https://example.com/api/proxy/v1?url=http://[${ip}]/`);
      const response = await handler(request);
      expect(response.status).toBe(403);
    });
  });
});
