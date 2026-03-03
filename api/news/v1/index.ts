import { handleCors } from '../../_shared/cors.js';
import { getCached } from '../../_shared/cache.js';
import { jsonResponse, errorResponse } from '../../_shared/error.js';

export const config = { runtime: 'edge' };

interface RSSItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  description?: string;
  enclosure?: { url?: string };
}

export default async function handler(request: Request): Promise<Response> {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const url = new URL(request.url);
  const feedUrls = url.searchParams.get('feeds');

  if (!feedUrls) {
    return errorResponse(400, 'Missing "feeds" query parameter');
  }

  const feeds = feedUrls.split(',').map(f => f.trim()).filter(Boolean);
  if (feeds.length === 0) {
    return errorResponse(400, 'No valid feed URLs provided');
  }

  try {
    const allItems: RSSItem[] = [];

    for (const feedUrl of feeds) {
      const items = await getCached(`rss:${feedUrl}`, 300, () => fetchRSSFeed(feedUrl));
      allItems.push(...items);
    }

    // Sort by date, newest first
    allItems.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    return jsonResponse({ items: allItems.slice(0, 100) });
  } catch (err) {
    return errorResponse(500, `RSS fetch failed: ${err}`);
  }
}

async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MonitorForge/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Feed returned ${response.status}: ${url}`);
  }

  const xml = await response.text();
  return parseRSS(xml);
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Simple regex-based RSS parser (works for both RSS 2.0 and Atom)
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1] ?? match[2] ?? '';
    items.push({
      title: extractTag(content, 'title'),
      link: extractTag(content, 'link') ?? extractAttr(content, 'link', 'href'),
      guid: extractTag(content, 'guid') ?? extractTag(content, 'id'),
      pubDate: extractTag(content, 'pubDate') ?? extractTag(content, 'published') ?? extractTag(content, 'updated'),
      description: extractTag(content, 'description') ?? extractTag(content, 'summary'),
    });
  }

  return items;
}

function extractTag(content: string, tag: string): string | undefined {
  const match = content.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? (match[1] ?? match[2])?.trim() : undefined;
}

function extractAttr(content: string, tag: string, attr: string): string | undefined {
  const match = content.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`, 'i'));
  return match?.[1]?.trim();
}
