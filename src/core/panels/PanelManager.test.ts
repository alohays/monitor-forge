// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PanelManager } from './PanelManager.js';
import { registerPanelType } from './panel-registry.js';
import { PanelBase, type PanelConfig } from './PanelBase.js';

class MockPanel extends PanelBase {
  static instances: MockPanel[] = [];
  rendered = false;
  lastData: unknown = undefined;
  destroyed = false;
  constructor(container: HTMLElement, config: PanelConfig) {
    super(container, config);
    MockPanel.instances.push(this);
  }
  render(): void { this.rendered = true; }
  update(data: unknown): void { this.lastData = data; }
  destroy(): void { this.destroyed = true; }
}

beforeEach(() => {
  MockPanel.instances = [];
  registerPanelType('mock-mgr-panel', MockPanel);
});

describe('PanelManager', () => {
  it('creates panels sorted by position', () => {
    const container = document.createElement('div');
    const manager = new PanelManager(container);
    manager.initialize([
      { name: 'second', type: 'mock-mgr-panel', displayName: 'Second', position: 2, config: {} },
      { name: 'first', type: 'mock-mgr-panel', displayName: 'First', position: 1, config: {} },
    ]);
    const panelDivs = container.querySelectorAll('.forge-panel');
    expect(panelDivs).toHaveLength(2);
    // First panel div should be "first" (position 1)
    expect(panelDivs[0].querySelector('.forge-panel-title')?.textContent).toBe('First');
  });

  it('skips panels with unknown types gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    const manager = new PanelManager(container);
    manager.initialize([
      { name: 'bad', type: 'nonexistent-type', displayName: 'Bad', position: 0, config: {} },
    ]);
    // The container div is created but createPanel throws, so warn is called
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('updateAll calls update on each panel', () => {
    const container = document.createElement('div');
    const manager = new PanelManager(container);
    manager.initialize([
      { name: 'p1', type: 'mock-mgr-panel', displayName: 'P1', position: 0, config: {} },
      { name: 'p2', type: 'mock-mgr-panel', displayName: 'P2', position: 1, config: {} },
    ]);
    const testData = [{ id: '1' }];
    manager.updateAll(testData);
    expect(MockPanel.instances).toHaveLength(2);
    for (const panel of MockPanel.instances) {
      expect(panel.lastData).toEqual(testData);
    }
  });

  it('destroy clears all panels', () => {
    const container = document.createElement('div');
    const manager = new PanelManager(container);
    manager.initialize([
      { name: 'disposable', type: 'mock-mgr-panel', displayName: 'D', position: 0, config: {} },
    ]);
    expect(container.innerHTML).not.toBe('');
    manager.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('renders panel headers with toggle button', () => {
    const container = document.createElement('div');
    const manager = new PanelManager(container);
    manager.initialize([
      { name: 'togglable', type: 'mock-mgr-panel', displayName: 'Togglable', position: 0, config: {} },
    ]);
    const toggleBtn = container.querySelector('.forge-panel-toggle');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn?.textContent).toBe('-');
  });
});
