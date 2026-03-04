// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { registerPanelType, createPanel, getRegisteredPanelTypes } from './panel-registry.js';
import { PanelBase, type PanelConfig } from './PanelBase.js';

class MockPanel extends PanelBase {
  render(): void {}
  update(): void {}
  destroy(): void {}
}

const testConfig: PanelConfig = {
  name: 'test-panel',
  type: 'mock-panel',
  displayName: 'Test Panel',
  position: 0,
  config: {},
};

describe('panel-registry', () => {
  it('registers and creates a panel by type', () => {
    registerPanelType('mock-panel', MockPanel);
    const container = document.createElement('div');
    const panel = createPanel(container, testConfig);
    expect(panel).toBeInstanceOf(MockPanel);
    expect(panel.getName()).toBe('test-panel');
  });

  it('throws for unknown panel type', () => {
    const container = document.createElement('div');
    expect(() => createPanel(container, { ...testConfig, type: 'nonexistent' })).toThrow('Unknown panel type');
  });

  it('lists registered types', () => {
    registerPanelType('mock-panel-list', MockPanel);
    const types = getRegisteredPanelTypes();
    expect(types).toContain('mock-panel-list');
  });

  it('returns getters from PanelBase', () => {
    registerPanelType('mock-panel-getters', MockPanel);
    const container = document.createElement('div');
    const panel = createPanel(container, { ...testConfig, type: 'mock-panel-getters', displayName: 'Display', position: 5 });
    expect(panel.getDisplayName()).toBe('Display');
    expect(panel.getPosition()).toBe(5);
  });
});
