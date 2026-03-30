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
  authEnvVar?: string;
  authHeader: string;
  cacheTtl: number;
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

  private static readonly MAX_SEEN_IDS = 10_000;
  private static readonly EVICTION_BATCH = 2_000;

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
    // Evict oldest entries when seenIds reaches capacity (V8 Set preserves insertion order)
    if (this.seenIds.size >= SourceBase.MAX_SEEN_IDS) {
      const iterator = this.seenIds.values();
      for (let i = 0; i < SourceBase.EVICTION_BATCH; i++) {
        const val = iterator.next();
        if (val.done) break;
        this.seenIds.delete(val.value);
      }
    }

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
