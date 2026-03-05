import { handleCors } from '../../_shared/cors.js';
import { getCached } from '../../_shared/cache.js';
import { jsonResponse, errorResponse } from '../../_shared/error.js';
import { XMLParser } from 'fast-xml-parser';

export const config = { runtime: 'edge' };

interface RSSItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  description?: string;
  enclosure?: { url?: string };
  thumbnail?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (_name: string, jpath: string) =>
    jpath === 'rss.channel.item' || jpath === 'feed.entry',
});

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
  let parsed: Record<string, unknown>;
  try {
    // Strip DOCTYPE declarations to prevent external entity errors
    const sanitized = xml.replace(/<!DOCTYPE\s[^[>]*(?:\[[\s\S]*?\])?[^>]*>/gi, '');
    parsed = parser.parse(sanitized) as Record<string, unknown>;
  } catch {
    return [];
  }

  const items: RSSItem[] = [];

  // RSS 2.0: rss.channel.item[]
  const channel = (parsed?.rss as Record<string, unknown>)?.channel as Record<string, unknown> | undefined;
  const rssItems: unknown[] = (channel?.item as unknown[]) ?? [];

  for (const raw of rssItems) {
    const item = raw as Record<string, unknown>;
    const parsed_item: RSSItem = {
      title: textValue(item.title),
      link: textValue(item.link),
      guid: textValue(item.guid),
      pubDate: textValue(item.pubDate),
      description: textValue(item.description) ?? textValue(item['content:encoded']),
      enclosure: extractEnclosure(item),
      thumbnail: extractThumbnail(item),
    };
    if (parsed_item.title || parsed_item.link || parsed_item.guid) {
      items.push(parsed_item);
    }
  }

  // Atom: feed.entry[]
  const feed = parsed?.feed as Record<string, unknown> | undefined;
  const atomEntries: unknown[] = (feed?.entry as unknown[]) ?? [];

  for (const raw of atomEntries) {
    const entry = raw as Record<string, unknown>;
    const parsed_entry: RSSItem = {
      title: textValue(entry.title),
      link: extractAtomLink(entry.link),
      guid: textValue(entry.id),
      pubDate: textValue(entry.published) ?? textValue(entry.updated),
      description: textValue(entry.summary) ?? textValue(entry.content),
    };
    if (parsed_entry.title || parsed_entry.link || parsed_entry.guid) {
      items.push(parsed_entry);
    }
  }

  return items;
}

function textValue(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null && '#text' in val) {
    return String((val as Record<string, unknown>)['#text']).trim() || undefined;
  }
  return undefined;
}

function extractEnclosure(item: Record<string, unknown>): { url?: string } | undefined {
  const enc = item.enclosure as Record<string, unknown> | undefined;
  if (!enc) return undefined;
  const url = enc['@_url'];
  return url ? { url: String(url) } : undefined;
}

function extractThumbnail(item: Record<string, unknown>): string | undefined {
  const thumb = item['media:thumbnail'] as Record<string, unknown> | string | undefined;
  if (thumb) {
    const url = typeof thumb === 'string' ? thumb : thumb['@_url'];
    if (url) return String(url);
  }
  const media = item['media:content'] as Record<string, unknown> | undefined;
  if (media) {
    const url = media['@_url'];
    if (url) return String(url);
  }
  return undefined;
}

function extractAtomLink(link: unknown): string | undefined {
  if (!link) return undefined;
  if (typeof link === 'string') return link;
  if (typeof link === 'object' && !Array.isArray(link)) {
    return (link as Record<string, unknown>)['@_href'] as string | undefined;
  }
  if (Array.isArray(link)) {
    const alt = link.find((l: Record<string, unknown>) => l['@_rel'] === 'alternate' && l['@_href']);
    if (alt) return alt['@_href'] as string;
    const first = link.find((l: Record<string, unknown>) => l['@_href']);
    return first?.['@_href'] as string | undefined;
  }
  return undefined;
}
