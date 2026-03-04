import DOMPurify from 'dompurify';
import { PanelBase } from '../PanelBase.js';

interface RiskScore {
  country: string;
  score: number;
  trend: 'rising' | 'falling' | 'stable';
  components: { conflict: number; unrest: number; economic: number };
}

export class InstabilityIndexPanel extends PanelBase {
  private scores: RiskScore[] = [];

  render(): void {
    this.container.innerHTML = `
      <div class="instability-index">
        <div class="instability-items"></div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.scores = (data as RiskScore[]).sort((a, b) => b.score - a.score);
    this.renderScores();
  }

  private renderScores(): void {
    const itemsEl = this.container.querySelector('.instability-items');
    if (!itemsEl) return;

    itemsEl.innerHTML = this.scores.map(s => {
      const trendIcon = s.trend === 'rising' ? '&#9650;' : s.trend === 'falling' ? '&#9660;' : '&#9654;';
      const riskClass = s.score > 7 ? 'risk-high' : s.score > 4 ? 'risk-medium' : 'risk-low';
      return `
        <div class="instability-item ${riskClass}">
          <span class="instability-country">${DOMPurify.sanitize(s.country)}</span>
          <span class="instability-score">${s.score.toFixed(1)}</span>
          <span class="instability-trend">${trendIcon}</span>
        </div>
      `;
    }).join('');
  }

  destroy(): void { this.container.innerHTML = ''; }
}
