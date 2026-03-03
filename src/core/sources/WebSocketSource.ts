import { SourceBase, type SourceItem } from './SourceBase.js';

export class WebSocketSource extends SourceBase {
  private ws: WebSocket | null = null;
  private buffer: SourceItem[] = [];

  async fetch(): Promise<SourceItem[]> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    const items = [...this.buffer];
    this.buffer = [];
    return items;
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error(`WebSocket error for ${this.config.name}`));

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          const item: SourceItem = {
            id: String(data.id ?? `${this.config.name}-${Date.now()}`),
            title: String(data.title ?? data.message ?? ''),
            url: String(data.url ?? ''),
            source: this.config.name,
            category: this.config.category,
            timestamp: new Date(data.timestamp ?? Date.now()),
            metadata: data,
          };
          this.buffer.push(item);

          // Keep buffer manageable
          if (this.buffer.length > 1000) {
            this.buffer = this.buffer.slice(-500);
          }
        } catch {
          // Skip unparseable messages
        }
      };

      this.ws.onclose = () => {
        // Auto-reconnect after interval
        setTimeout(() => this.connect(), this.config.interval * 1000);
      };
    });
  }
}
