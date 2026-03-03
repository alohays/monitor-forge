import { PanelBase } from '../PanelBase.js';
import DOMPurify from 'dompurify';

interface TickerItem {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
}

export class MarketTickerPanel extends PanelBase {
  private tickers: TickerItem[] = [];

  render(): void {
    this.container.innerHTML = `
      <div class="market-ticker">
        <div class="market-ticker-items"></div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.tickers = data as TickerItem[];
    this.renderTickers();
  }

  private renderTickers(): void {
    const itemsEl = this.container.querySelector('.market-ticker-items');
    if (!itemsEl) return;

    itemsEl.innerHTML = this.tickers.map(t => {
      const isPositive = t.change >= 0;
      const changeClass = isPositive ? 'ticker-up' : 'ticker-down';
      const arrow = isPositive ? '&#9650;' : '&#9660;';
      return `
        <div class="ticker-item ${changeClass}">
          <span class="ticker-symbol">${DOMPurify.sanitize(t.symbol)}</span>
          <span class="ticker-price">${t.price.toFixed(2)}</span>
          <span class="ticker-change">${arrow} ${Math.abs(t.changePercent).toFixed(2)}%</span>
        </div>
      `;
    }).join('');
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
