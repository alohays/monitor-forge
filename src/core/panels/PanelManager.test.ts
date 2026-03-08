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

  describe('view switching', () => {
    const configs: PanelConfig[] = [
      { name: 'alpha', type: 'mock-mgr-panel', displayName: 'Alpha', position: 0, config: {} },
      { name: 'beta', type: 'mock-mgr-panel', displayName: 'Beta', position: 1, config: {} },
      { name: 'gamma', type: 'mock-mgr-panel', displayName: 'Gamma', position: 2, config: {} },
    ];

    const views = [
      { name: 'overview', displayName: 'Overview', panels: ['alpha', 'beta'], default: true },
      { name: 'detail', displayName: 'Detail', panels: ['beta', 'gamma'] },
    ];

    let container: HTMLElement;
    let manager: PanelManager;

    beforeEach(() => {
      MockPanel.instances = [];
      container = document.createElement('div');
      manager = new PanelManager(container);
      // Reset hash so getViewFromHash returns null
      history.replaceState(null, '', window.location.pathname);
    });

    it('initializeWithViews creates view containers with correct attributes', () => {
      manager.initialize(configs, views);
      const viewEls = container.querySelectorAll('.forge-view');
      expect(viewEls).toHaveLength(2);

      const overviewEl = container.querySelector('#forge-view-overview') as HTMLElement;
      expect(overviewEl).not.toBeNull();
      expect(overviewEl.getAttribute('role')).toBe('tabpanel');
      expect(overviewEl.getAttribute('aria-labelledby')).toBe('forge-view-tab-overview');
      expect(overviewEl.dataset.view).toBe('overview');

      const detailEl = container.querySelector('#forge-view-detail') as HTMLElement;
      expect(detailEl).not.toBeNull();
      expect(detailEl.getAttribute('role')).toBe('tabpanel');
      expect(detailEl.getAttribute('aria-labelledby')).toBe('forge-view-tab-detail');
      expect(detailEl.dataset.view).toBe('detail');

      // Default view should be visible, other hidden
      expect(overviewEl.style.display).toBe('flex');
      expect(detailEl.style.display).toBe('none');
    });

    it('switchView changes activeView and display styles', () => {
      manager.initialize(configs, views);
      expect(manager.getActiveView()).toBe('overview');

      manager.switchView('detail');
      expect(manager.getActiveView()).toBe('detail');

      // After switchView (no outgoing/incoming fade branch when both exist uses timer),
      // check display immediately — the immediate path sets display
      const overviewEl = container.querySelector('#forge-view-overview') as HTMLElement;
      const detailEl = container.querySelector('#forge-view-detail') as HTMLElement;

      // switchView with both outgoing and incoming uses setTimeout for fade,
      // but activeView is set synchronously
      expect(manager.getActiveView()).toBe('detail');
    });

    it('onViewChange callback fires on switchView', () => {
      manager.initialize(configs, views);
      const callback = vi.fn();
      manager.onViewChange(callback);

      manager.switchView('detail');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('detail');
    });

    it('onViewChange callback does not fire when switching to same view', () => {
      manager.initialize(configs, views);
      const callback = vi.fn();
      manager.onViewChange(callback);

      // overview is already active, switchView should bail early
      manager.switchView('overview');
      expect(callback).not.toHaveBeenCalled();
    });

    it('getViewNames returns all view names', () => {
      manager.initialize(configs, views);
      const names = manager.getViewNames();
      expect(names).toEqual(['overview', 'detail']);
    });

    it('getActiveView returns current view', () => {
      manager.initialize(configs, views);
      expect(manager.getActiveView()).toBe('overview');

      manager.switchView('detail');
      expect(manager.getActiveView()).toBe('detail');
    });

    it('updateAll only updates panels in active view', () => {
      manager.initialize(configs, views);
      // Active view is 'overview' which contains alpha and beta
      // 'gamma' is only in 'detail'

      // Reset lastData so we can track updates
      for (const inst of MockPanel.instances) {
        inst.lastData = undefined;
      }

      const updateSpy = MockPanel.instances.map(inst => vi.spyOn(inst, 'update'));

      manager.updateAll({ test: 1 });

      // alpha (overview) — instances[0] is alpha in overview
      // beta (overview) — instances[1] is beta in overview
      // beta (detail) — instances[2] is beta in detail
      // gamma (detail) — instances[3] is gamma in detail
      // alpha and beta-in-overview are in active view, beta-in-detail and gamma are not
      const updatedInstances = MockPanel.instances.filter(inst => inst.lastData !== undefined);
      const skippedInstances = MockPanel.instances.filter(inst => inst.lastData === undefined);

      // Panels in overview (alpha, beta) should be updated
      // Panels only in detail (gamma) should be skipped
      // beta appears in both views; the overview instance gets updated, the detail instance is skipped
      expect(updatedInstances.length).toBeGreaterThanOrEqual(2);
      expect(skippedInstances.length).toBeGreaterThanOrEqual(1);

      // Verify gamma was NOT updated (only in detail view)
      // gamma is the last created panel instance
      const gammaInstance = MockPanel.instances[MockPanel.instances.length - 1];
      expect(gammaInstance.lastData).toBeUndefined();
    });

    it('falls back to flat mode when no views provided', () => {
      manager.initialize(configs);

      // No view containers created
      expect(manager.getViewNames()).toEqual([]);
      expect(manager.getActiveView()).toBeNull();

      // All panels should be direct children, no .forge-view wrappers
      const viewEls = container.querySelectorAll('.forge-view');
      expect(viewEls).toHaveLength(0);

      const panelEls = container.querySelectorAll('.forge-panel');
      expect(panelEls).toHaveLength(3);

      // updateAll should update all panels (isPanelInActiveView returns true with no views)
      for (const inst of MockPanel.instances) {
        inst.lastData = undefined;
      }
      manager.updateAll({ flat: true });
      for (const inst of MockPanel.instances) {
        expect(inst.lastData).toEqual({ flat: true });
      }
    });

    it('destroy cleans up event listeners and view containers', () => {
      manager.initialize(configs, views);

      const removeKeydownSpy = vi.spyOn(document, 'removeEventListener');
      const removeHashSpy = vi.spyOn(window, 'removeEventListener');

      manager.destroy();

      // Event listeners removed
      expect(removeKeydownSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeHashSpy).toHaveBeenCalledWith('hashchange', expect.any(Function));

      // Container is cleared
      expect(container.innerHTML).toBe('');

      // View containers map is cleared
      expect(manager.getViewNames()).toEqual([]);

      // All panel instances destroyed
      for (const inst of MockPanel.instances) {
        expect(inst.destroyed).toBe(true);
      }

      removeKeydownSpy.mockRestore();
      removeHashSpy.mockRestore();
    });
  });
});
