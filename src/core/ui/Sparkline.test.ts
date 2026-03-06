// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Sparkline } from './Sparkline.js';

describe('Sparkline', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('creates an SVG element in the container', () => {
    const sparkline = new Sparkline(container);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 60 20');
    sparkline.destroy();
  });

  it('renders line and area path elements', () => {
    const sparkline = new Sparkline(container);
    sparkline.pushValue(10);
    sparkline.pushValue(20);

    const linePath = container.querySelector('.sparkline-line');
    const areaPath = container.querySelector('.sparkline-area');
    expect(linePath).not.toBeNull();
    expect(areaPath).not.toBeNull();
    // D3 transitions set 'd' asynchronously in happy-dom, so we only verify elements exist
    sparkline.destroy();
  });

  it('handles single data point without error', () => {
    const sparkline = new Sparkline(container);
    expect(() => sparkline.pushValue(42)).not.toThrow();
    sparkline.destroy();
  });

  it('removes SVG on destroy', () => {
    const sparkline = new Sparkline(container);
    sparkline.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('respects custom dimensions', () => {
    const sparkline = new Sparkline(container, { width: 100, height: 30 });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 30');
    sparkline.destroy();
  });
});
