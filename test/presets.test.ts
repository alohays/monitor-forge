import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitorForgeConfigSchema, SourceSchema } from '../forge/src/config/schema.js';
import { createDefaultConfig } from '../forge/src/config/defaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetDir = resolve(__dirname, '../presets');
const presetFiles = readdirSync(presetDir).filter(f => f.endsWith('.json'));

describe('presets', () => {
  it('has all 15 expected preset files', () => {
    const expectedNames = [
      'blank.json', 'tech-minimal.json', 'tech-full.json',
      'finance-minimal.json', 'finance-full.json',
      'geopolitics-minimal.json', 'geopolitics-full.json',
      'cyber-minimal.json', 'cyber-full.json',
      'climate-minimal.json', 'climate-full.json',
      'korea-minimal.json', 'korea-full.json',
      'health-minimal.json', 'health-full.json',
    ];
    for (const name of expectedNames) {
      expect(presetFiles).toContain(name);
    }
  });

  describe.each(presetFiles)('preset: %s', (filename) => {
    const raw = JSON.parse(readFileSync(resolve(presetDir, filename), 'utf-8'));

    it('is valid JSON with monitor field', () => {
      expect(raw).toHaveProperty('monitor');
      expect(raw.monitor).toHaveProperty('name');
      expect(raw.monitor).toHaveProperty('slug');
      expect(raw.monitor).toHaveProperty('domain');
    });

    it('passes schema validation after createDefaultConfig merge', () => {
      const config = createDefaultConfig(raw);
      expect(() => MonitorForgeConfigSchema.parse(config)).not.toThrow();
    });

    it('has valid source URLs', () => {
      for (const source of raw.sources ?? []) {
        expect(() => new URL(source.url)).not.toThrow();
      }
    });

    it('has valid source configurations', () => {
      for (const source of raw.sources ?? []) {
        expect(() => SourceSchema.parse(source)).not.toThrow();
      }
    });

    it('has unique source names', () => {
      const names = (raw.sources ?? []).map((s: { name: string }) => s.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('has unique panel names', () => {
      const names = (raw.panels ?? []).map((p: { name: string }) => p.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('has valid _meta block', () => {
      expect(raw._meta).toBeDefined();
      expect(raw._meta.category).toBeDefined();
      expect(raw._meta.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
      expect(Array.isArray(raw._meta.requires_api_keys)).toBe(true);
      expect(Array.isArray(raw._meta.optional_api_keys)).toBe(true);
      expect(typeof raw._meta.preview_description).toBe('string');
    });
  });
});
