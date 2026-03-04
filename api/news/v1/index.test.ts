import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './index.js';

vi.mock('../../_shared/cache.js', () => ({
  getCached: async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

const sampleRSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <guid>guid-1</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description>First article</description>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <guid>guid-2</guid>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <description>Second article</description>
    </item>
  </channel>
</rss>`;

const sampleAtom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom/1" />
    <id>atom-1</id>
    <published>2024-01-03T12:00:00Z</published>
    <summary>An atom entry</summary>
  </entry>
</feed>`;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('news/v1 handler', () => {
  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const request = new Request('https://example.com/api/news/v1?feeds=x', { method: 'OPTIONS' });
    const response = await handler(request);
    expect(response.status).toBe(204);
  });

  it('returns 400 when feeds param missing', async () => {
    const request = new Request('https://example.com/api/news/v1');
    const response = await handler(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('feeds');
  });

  it('returns 400 when feeds param is empty', async () => {
    const request = new Request('https://example.com/api/news/v1?feeds=');
    const response = await handler(request);
    expect(response.status).toBe(400);
  });

  it('fetches and parses RSS 2.0 XML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sampleRSS, { status: 200, headers: { 'Content-Type': 'application/xml' } }),
    );
    const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/rss');
    const response = await handler(request);
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ title: string }> };
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items.some(i => i.title === 'Article One')).toBe(true);
  });

  it('fetches and parses Atom XML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sampleAtom, { status: 200 }),
    );
    const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/atom');
    const response = await handler(request);
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ title: string; guid: string }> };
    expect(body.items.some(i => i.title === 'Atom Entry')).toBe(true);
    expect(body.items.some(i => i.guid === 'atom-1')).toBe(true);
  });

  it('sorts items by date descending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sampleRSS, { status: 200 }),
    );
    const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/rss');
    const response = await handler(request);
    const body = await response.json() as { items: Array<{ pubDate: string }> };
    const dates = body.items.map(i => new Date(i.pubDate!).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it('returns 500 when upstream fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    // Use a unique URL to avoid cache hit from prior tests
    const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/fail-rss');
    const response = await handler(request);
    expect(response.status).toBe(500);
  });

  // ─── Malformed & Malicious XML Handling ───────────────────

  describe('malformed and malicious XML handling', () => {
    it('returns empty items for truncated XML', async () => {
      const truncated = `<?xml version="1.0"?><rss><channel><item><title>Truncated`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(truncated, { status: 200 }),
      );
      const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/truncated');
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: unknown[] };
      // Truncated <item> without </item> won't match the regex → 0 items
      expect(body.items).toHaveLength(0);
    });

    it('returns empty items for feed with no items', async () => {
      const emptyFeed = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(emptyFeed, { status: 200 }),
      );
      const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/empty');
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: unknown[] };
      expect(body.items).toHaveLength(0);
    });

    it('extracts content from CDATA sections', async () => {
      const cdataXml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title><![CDATA[CDATA Title & <Special>]]></title>
          <link>https://example.com/cdata</link>
          <guid>cdata-1</guid>
          <description><![CDATA[Content with <b>HTML</b> tags]]></description>
        </item>
      </channel></rss>`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(cdataXml, { status: 200 }),
      );
      const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/cdata');
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: Array<{ title: string; description: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe('CDATA Title & <Special>');
      expect(body.items[0].description).toContain('HTML');
    });

    it('handles items with missing title gracefully', async () => {
      const noTitle = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <link>https://example.com/no-title</link>
          <guid>nt-1</guid>
        </item>
      </channel></rss>`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(noTitle, { status: 200 }),
      );
      const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/no-title');
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: Array<{ title?: string; link: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBeUndefined();
      expect(body.items[0].link).toBe('https://example.com/no-title');
    });

    it('is immune to XXE attacks (regex-based parser)', async () => {
      const xxePayload = `<?xml version="1.0"?>
      <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <rss version="2.0"><channel>
        <item>
          <title>&xxe;</title>
          <link>https://example.com/xxe</link>
          <guid>xxe-1</guid>
        </item>
      </channel></rss>`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(xxePayload, { status: 200 }),
      );
      const request = new Request('https://example.com/api/news/v1?feeds=https://feed.example.com/xxe');
      const response = await handler(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: Array<{ title: string }> };
      // Regex parser doesn't expand entities — title is the raw "&xxe;" text or undefined
      expect(body.items[0].title).not.toContain('/etc/passwd');
    });

    it('handles multiple feeds with mixed success', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(sampleRSS, { status: 200 }))
        .mockRejectedValueOnce(new Error('Feed 2 down'));
      // When one feed fails, the entire request fails (current behavior)
      const request = new Request(
        'https://example.com/api/news/v1?feeds=https://feed.example.com/ok,https://feed.example.com/bad-multi'
      );
      const response = await handler(request);
      expect(response.status).toBe(500);
    });
  });
});
