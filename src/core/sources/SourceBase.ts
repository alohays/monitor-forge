export interface SourceConfig {
  name: string;
  type: string;
  url: string;
  interval: number;
  category: string;
  tier: number;
  tags: string[];
  language: string;
  headers?: Record<string, string>;
  transform?: string;
}

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  timestamp: Date;
  summary?: string;
  imageUrl?: string;
  language?: string;
  entities?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  metadata?: Record<string, unknown>;
}

export abstract class SourceBase {
  protected config: SourceConfig;
  private cache = new Map<string, { items: SourceItem[]; expires: number }>();
  private seenIds = new Set<string>();

  constructor(config: SourceConfig) {
    this.config = config;
  }

  abstract fetch(): Promise<SourceItem[]>;

  async fetchWithCache(): Promise<SourceItem[]> {
    const cacheKey = this.config.name;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.items;
    }

    const items = await this.fetch();
    const deduped = this.deduplicate(items);
    this.cache.set(cacheKey, {
      items: deduped,
      expires: Date.now() + this.config.interval * 1000,
    });
    return deduped;
  }

  protected deduplicate(items: SourceItem[]): SourceItem[] {
    return items.filter(item => {
      if (this.seenIds.has(item.id)) return false;
      this.seenIds.add(item.id);
      return true;
    });
  }

  getName(): string { return this.config.name; }
  getCategory(): string { return this.config.category; }
  getInterval(): number { return this.config.interval; }
}
