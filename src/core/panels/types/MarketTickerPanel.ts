import { PanelBase } from '../PanelBase.js';
import { AnimatedCounter } from '../../ui/AnimatedCounter.js';
import { Sparkline } from '../../ui/Sparkline.js';

interface TickerItem {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
}

interface TickerRow {
  element: HTMLElement;
  priceCounter: AnimatedCounter;
  changeCounter: AnimatedCounter;
  sparkline: Sparkline;
}

export class MarketTickerPanel extends PanelBase {
  private rows = new Map<string, TickerRow>();
  private priceHistory = new Map<string, number[]>();
  private itemsContainer: HTMLElement | null = null;

  render(): void {
    this.container.innerHTML = '<div class="market-ticker"><div class="market-ticker-items"></div></div>';
    this.showSkeleton(4);
    this.itemsContainer = this.container.querySelector('.market-ticker-items');
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    const tickers = data as TickerItem[];
    this.markDataReceived();
    this.diffUpdate(tickers);
  }

  private diffUpdate(tickers: TickerItem[]): void {
    if (!this.itemsContainer) return;

    const newSymbols = new Set(tickers.map(t => t.symbol));

    // Remove rows no longer in data
    for (const [symbol, row] of this.rows) {
      if (!newSymbols.has(symbol)) {
        row.sparkline.destroy();
        row.priceCounter.destroy();
        row.changeCounter.destroy();
        row.element.remove();
        this.rows.delete(symbol);
        this.priceHistory.delete(symbol);
      }
    }

    // Update or create rows
    for (const ticker of tickers) {
      const existing = this.rows.get(ticker.symbol);
      if (existing) {
        this.updateRow(existing, ticker);
      } else {
        this.createRow(ticker);
      }

      // Track price history
      const history = this.priceHistory.get(ticker.symbol) ?? [];
      history.push(ticker.price);
      if (history.length > 20) history.shift();
      this.priceHistory.set(ticker.symbol, history);
    }

    // Reorder DOM to match data order
    for (const ticker of tickers) {
      const row = this.rows.get(ticker.symbol);
      if (row) this.itemsContainer.appendChild(row.element);
    }
  }

  private createRow(ticker: TickerItem): void {
    const el = document.createElement('div');
    el.className = `ticker-item ${ticker.change >= 0 ? 'ticker-up' : 'ticker-down'}`;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'ticker-symbol';
    symbolSpan.textContent = ticker.symbol;

    const sparkContainer = document.createElement('span');
    sparkContainer.className = 'ticker-sparkline';

    const priceSpan = document.createElement('span');
    priceSpan.className = 'ticker-price';

    const changeSpan = document.createElement('span');
    changeSpan.className = 'ticker-change';

    el.append(symbolSpan, sparkContainer, priceSpan, changeSpan);
    this.itemsContainer?.appendChild(el);

    const isPositive = ticker.change >= 0;

    const priceCounter = new AnimatedCounter(priceSpan, {
      format: (n) => n.toFixed(2),
      initialValue: ticker.price,
    });

    const changeCounter = new AnimatedCounter(changeSpan, {
      format: (n) => `${n >= 0 ? '\u25B2' : '\u25BC'} ${Math.abs(n).toFixed(2)}%`,
      initialValue: ticker.changePercent,
    });

    const sparkline = new Sparkline(sparkContainer, {
      width: 60,
      height: 20,
      maxPoints: 20,
      color: isPositive ? 'var(--success)' : 'var(--danger)',
    });
    sparkline.pushValue(ticker.price);

    this.rows.set(ticker.symbol, { element: el, priceCounter, changeCounter, sparkline });
  }

  private updateRow(row: TickerRow, ticker: TickerItem): void {
    const isPositive = ticker.change >= 0;
    row.element.className = `ticker-item ${isPositive ? 'ticker-up' : 'ticker-down'}`;
    row.priceCounter.setValue(ticker.price);
    row.changeCounter.setValue(ticker.changePercent);
    row.sparkline.setColor(isPositive ? 'var(--success)' : 'var(--danger)');
    row.sparkline.pushValue(ticker.price);
  }

  destroy(): void {
    this.cleanupTimers();
    for (const row of this.rows.values()) {
      row.sparkline.destroy();
      row.priceCounter.destroy();
      row.changeCounter.destroy();
    }
    this.rows.clear();
    this.priceHistory.clear();
    this.container.innerHTML = '';
  }
}
