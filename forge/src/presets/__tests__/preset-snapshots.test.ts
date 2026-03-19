import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitorForgeConfigSchema } from '../../config/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetDir = resolve(__dirname, '../../../../presets');
const presetFiles = readdirSync(presetDir).filter(f => f.endsWith('.json'));

describe('preset snapshot validation', () => {
  it('discovers all preset files', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(15);
  });

  describe.each(presetFiles)('%s', (filename) => {
    const raw = JSON.parse(readFileSync(resolve(presetDir, filename), 'utf-8'));

    it('has version field', () => {
      expect(raw).toHaveProperty('version');
      expect(typeof raw.version).toBe('string');
    });

    it('has _meta field', () => {
      expect(raw).toHaveProperty('_meta');
      expect(raw._meta).toHaveProperty('category');
      expect(raw._meta).toHaveProperty('difficulty');
      expect(raw._meta).toHaveProperty('preview_description');
    });

    it('passes MonitorForgeConfigSchema.parse() and matches snapshot', () => {
      const parsed = MonitorForgeConfigSchema.parse(raw);
      expect(parsed).toMatchSnapshot();
    });
  });
});
