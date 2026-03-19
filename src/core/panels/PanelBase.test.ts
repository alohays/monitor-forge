// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { PanelBase, type PanelConfig } from './PanelBase.js';

class TestPanel extends PanelBase {
  rendered = false;
  lastData: unknown = undefined;

  constructor(container: HTMLElement, config: PanelConfig) {
    super(container, config);
  }

  render(): void {
    this.rendered = true;
    this.showSkeleton(2);
  }

  update(data: unknown): void {
    this.lastData = data;
    this.markDataReceived();
  }

  destroy(): void {
    this.cleanupTimers();
    this.container.innerHTML = '';
  }
}

const makePanel = () => {
  const container = document.createElement('div');
  const panel = new TestPanel(container, {
    name: 'test-panel',
    type: 'test',
    displayName: 'Test Panel',
    position: 0,
    config: {},
  });
  return { panel, container };
};

describe('PanelBase degradation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renderDegraded() creates the degraded element', () => {
    const { panel, container } = makePanel();
    panel.renderDegraded('Something went wrong');
    const el = container.querySelector('.panel-degraded');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Something went wrong');
  });

  it('clearDegraded() removes the degraded element', () => {
    const { panel, container } = makePanel();
    panel.renderDegraded('Error message');
    expect(container.querySelector('.panel-degraded')).not.toBeNull();

    panel.clearDegraded();
    expect(container.querySelector('.panel-degraded')).toBeNull();
  });

  it('markDataReceived() calls clearDegraded()', () => {
    const { panel, container } = makePanel();
    panel.render();
    panel.renderDegraded('Waiting for data...');
    expect(container.querySelector('.panel-degraded')).not.toBeNull();

    // update() calls markDataReceived() which should clear degraded state
    panel.update({ some: 'data' });
    expect(container.querySelector('.panel-degraded')).toBeNull();
  });

  it('data arriving after degradation clears degraded state', () => {
    const { panel, container } = makePanel();
    panel.render();

    // First: panel is degraded
    panel.renderDegraded('No data sources responding.');
    expect(container.querySelector('.panel-degraded')).not.toBeNull();

    // Then: real data arrives
    panel.update({ items: [1, 2, 3] });
    expect(container.querySelector('.panel-degraded')).toBeNull();
    expect(panel.getHasReceivedData()).toBe(true);
  });

  it('renderDegraded() replaces previous degraded element', () => {
    const { panel, container } = makePanel();
    panel.renderDegraded('First message');
    panel.renderDegraded('Second message');
    const els = container.querySelectorAll('.panel-degraded');
    expect(els).toHaveLength(1);
    expect(els[0].textContent).toContain('Second message');
  });

  it('renderDegraded() wraps backtick commands with configure-hint class', () => {
    const { panel, container } = makePanel();
    panel.renderDegraded('Run `forge ai configure` to set up.');
    const hint = container.querySelector('.panel-configure-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('`forge ai configure`');
  });

  it('getHasReceivedData() returns false before data and true after', () => {
    const { panel } = makePanel();
    expect(panel.getHasReceivedData()).toBe(false);
    panel.update({ test: true });
    expect(panel.getHasReceivedData()).toBe(true);
  });
});
