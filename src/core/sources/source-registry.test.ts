import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerSource, createSource, getRegisteredSourceTypes } from './source-registry.js';
import { SourceBase, type SourceItem, type SourceConfig } from './SourceBase.js';

class MockSource extends SourceBase {
  async fetch(): Promise<SourceItem[]> {
    return [];
  }
}

const testConfig: SourceConfig = {
  name: 'test', type: 'mock', url: 'https://example.com',
  interval: 300, category: 'test', tier: 3, tags: [], language: 'en',
  authHeader: 'Authorization', cacheTtl: 300,
};

describe('source-registry', () => {
  it('registers and creates a source by type', () => {
    registerSource('mock', MockSource);
    const source = createSource({ ...testConfig, type: 'mock' });
    expect(source).toBeInstanceOf(MockSource);
    expect(source.getName()).toBe('test');
  });

  it('throws for unknown source type', () => {
    expect(() => createSource({ ...testConfig, type: 'nonexistent' })).toThrow('Unknown source type');
  });

  it('lists registered types', () => {
    registerSource('mock-list', MockSource);
    const types = getRegisteredSourceTypes();
    expect(types).toContain('mock-list');
  });

  it('allows overwriting a registered type', () => {
    class AnotherSource extends SourceBase {
      async fetch(): Promise<SourceItem[]> {
        return [{ id: 'x', title: 'X', url: '', source: '', category: '', timestamp: new Date() }];
      }
    }
    registerSource('overwrite-test', MockSource);
    registerSource('overwrite-test', AnotherSource);
    const source = createSource({ ...testConfig, type: 'overwrite-test' });
    expect(source).toBeInstanceOf(AnotherSource);
  });
});
