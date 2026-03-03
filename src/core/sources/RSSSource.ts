import { SourceBase, type SourceItem } from './SourceBase.js';

export class RSSSource extends SourceBase {
  async fetch(): Promise<SourceItem[]> {
    const proxyUrl = `/api/news/v1?feeds=${encodeURIComponent(this.config.url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

    const data = await response.json() as { items?: RSSItem[] };
    if (!data.items) return [];

    return data.items.map(item => ({
      id: item.guid || item.link || `${this.config.name}-${item.title}`,
      title: item.title ?? '',
      url: item.link ?? '',
      source: this.config.name,
      category: this.config.category,
      timestamp: new Date(item.pubDate ?? Date.now()),
      summary: item.description ?? undefined,
      imageUrl: item.enclosure?.url ?? item.thumbnail ?? undefined,
      language: this.config.language,
    }));
  }
}

interface RSSItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  description?: string;
  enclosure?: { url: string };
  thumbnail?: string;
}
