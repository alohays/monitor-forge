import { PanelBase } from '../PanelBase.js';
import { AnimatedCounter } from '../../ui/AnimatedCounter.js';

interface RiskScore {
  country: string;
  score: number;
  trend: 'rising' | 'falling' | 'stable';
  components: { conflict: number; unrest: number; economic: number };
}

interface ScoreRow {
  element: HTMLElement;
  scoreCounter: AnimatedCounter;
  barFill: HTMLElement;
}

export class InstabilityIndexPanel extends PanelBase {
  private rows = new Map<string, ScoreRow>();
  private itemsContainer: HTMLElement | null = null;

  render(): void {
    this.container.innerHTML = '<div class="instability-index"><div class="instability-items"></div></div>';
    this.showSkeleton(3);
    this.itemsContainer = this.container.querySelector('.instability-items');
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    const scores = (data as RiskScore[]).sort((a, b) => b.score - a.score);
    this.markDataReceived();
    this.diffUpdate(scores);
  }

  private diffUpdate(scores: RiskScore[]): void {
    if (!this.itemsContainer) return;

    const newCountries = new Set(scores.map(s => s.country));

    // Remove rows no longer in data
    for (const [country, row] of this.rows) {
      if (!newCountries.has(country)) {
        row.scoreCounter.destroy();
        row.element.remove();
        this.rows.delete(country);
      }
    }

    // Update or create rows
    for (const score of scores) {
      const existing = this.rows.get(score.country);
      if (existing) {
        this.updateRow(existing, score);
      } else {
        this.createRow(score);
      }
    }

    // Reorder DOM to match data order
    for (const score of scores) {
      const row = this.rows.get(score.country);
      if (row) this.itemsContainer.appendChild(row.element);
    }
  }

  private createRow(score: RiskScore): void {
    const riskClass = score.score > 7 ? 'risk-high' : score.score > 4 ? 'risk-medium' : 'risk-low';
    const trendIcon = score.trend === 'rising' ? '\u25B2' : score.trend === 'falling' ? '\u25BC' : '\u25B6';

    const el = document.createElement('div');
    el.className = `instability-item ${riskClass}`;

    const countrySpan = document.createElement('span');
    countrySpan.className = 'instability-country';
    countrySpan.textContent = score.country;

    const barContainer = document.createElement('div');
    barContainer.className = 'instability-bar-container';

    const barFill = document.createElement('div');
    barFill.className = 'instability-bar-fill';
    const widthPercent = (score.score / 10) * 100;
    barFill.style.width = `${widthPercent}%`;
    barFill.style.backgroundPosition = `${widthPercent}% 0`;

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'instability-score';

    barContainer.append(barFill, scoreSpan);

    const trendSpan = document.createElement('span');
    trendSpan.className = 'instability-trend';
    trendSpan.textContent = trendIcon;

    el.append(countrySpan, barContainer, trendSpan);
    this.itemsContainer?.appendChild(el);

    const scoreCounter = new AnimatedCounter(scoreSpan, {
      format: (n) => n.toFixed(1),
      initialValue: score.score,
    });

    this.rows.set(score.country, { element: el, scoreCounter, barFill });
  }

  private updateRow(row: ScoreRow, score: RiskScore): void {
    const riskClass = score.score > 7 ? 'risk-high' : score.score > 4 ? 'risk-medium' : 'risk-low';
    row.element.className = `instability-item ${riskClass}`;

    const widthPercent = (score.score / 10) * 100;
    row.barFill.style.width = `${widthPercent}%`;
    row.barFill.style.backgroundPosition = `${widthPercent}% 0`;

    row.scoreCounter.setValue(score.score);

    const trendSpan = row.element.querySelector('.instability-trend');
    if (trendSpan) {
      trendSpan.textContent = score.trend === 'rising' ? '\u25B2' : score.trend === 'falling' ? '\u25BC' : '\u25B6';
    }
  }

  destroy(): void {
    this.cleanupTimers();
    for (const row of this.rows.values()) {
      row.scoreCounter.destroy();
    }
    this.rows.clear();
    this.container.innerHTML = '';
  }
}
