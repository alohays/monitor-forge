import { SourceBase, type SourceItem } from './SourceBase.js';

export class APISource extends SourceBase {
  async fetch(): Promise<SourceItem[]> {
    const headers: Record<string, string> = { ...this.config.headers };

    // Resolve env variable references in headers
    for (const [key, value] of Object.entries(headers)) {
      const match = value.match(/\$\{env\.([A-Z_][A-Z0-9_]*)\}/);
      if (match) {
        headers[key] = value.replace(match[0], import.meta.env?.[match[1]] ?? '');
      }
    }

    const response = await fetch(this.config.url, { headers });
    if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);

    const data = await response.json();

    // Apply JSONPath-like transform
    const items = this.config.transform
      ? getNestedValue(data, this.config.transform)
      : Array.isArray(data) ? data : [data];

    if (!Array.isArray(items)) return [];

    return items.map((item: Record<string, unknown>, i: number) => ({
      id: String(item.id ?? `${this.config.name}-${i}`),
      title: String(item.title ?? item.name ?? ''),
      url: String(item.url ?? item.link ?? ''),
      source: this.config.name,
      category: this.config.category,
      timestamp: new Date(String(item.timestamp ?? item.date ?? Date.now())),
      summary: item.summary ? String(item.summary) : undefined,
      metadata: item,
    }));
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
