// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceStatusPanel } from './ServiceStatusPanel.js';
import type { SourceHealth } from '../../sources/SourceHealth.js';

const makePanel = () => {
  const container = document.createElement('div');
  const panel = new ServiceStatusPanel(container, {
    name: 'service-status',
    type: 'service-status',
    displayName: 'Source Health',
    position: 0,
    config: {},
  });
  panel.render();
  return { panel, container };
};

describe('ServiceStatusPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders service status from health Map', () => {
    const { panel, container } = makePanel();
    const health = new Map<string, SourceHealth>([
      ['feed-a', { status: 'online', lastSuccess: new Date(), lastError: null, consecutiveFailures: 0 }],
      ['feed-b', { status: 'offline', lastSuccess: null, lastError: 'timeout', consecutiveFailures: 3 }],
    ]);
    panel.update(health);
    const items = container.querySelectorAll('.service-item');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.service-name')?.textContent).toBe('feed-a');
    expect(items[1].querySelector('.service-name')?.textContent).toBe('feed-b');
  });

  it('shows correct dot colors for each status', () => {
    const { panel, container } = makePanel();
    const health = new Map<string, SourceHealth>([
      ['online-src', { status: 'online', lastSuccess: new Date(), lastError: null, consecutiveFailures: 0 }],
      ['degraded-src', { status: 'degraded', lastSuccess: null, lastError: 'err', consecutiveFailures: 1 }],
      ['offline-src', { status: 'offline', lastSuccess: null, lastError: 'err', consecutiveFailures: 5 }],
    ]);
    panel.update(health);
    const dots = container.querySelectorAll('.service-dot');
    expect(dots[0].classList.contains('status-green')).toBe(true);
    expect(dots[1].classList.contains('status-yellow')).toBe(true);
    expect(dots[2].classList.contains('status-red')).toBe(true);
  });

  it('handles empty health map', () => {
    const { panel, container } = makePanel();
    panel.update(new Map());
    const items = container.querySelectorAll('.service-item');
    expect(items).toHaveLength(0);
  });
});
