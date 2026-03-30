import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitorForgeConfigSchema } from '../forge/src/config/schema.js';
import { createDefaultConfig } from '../forge/src/config/defaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetsDir = resolve(__dirname, '../presets');
const presetFiles = readdirSync(presetsDir).filter(f => f.endsWith('.json'));

describe('All presets validate against schema', () => {
  it.each(presetFiles)('preset %s is valid', (file) => {
    const raw = JSON.parse(readFileSync(resolve(presetsDir, file), 'utf-8'));
    // Remove _meta before validation (intentionally not in schema)
    const { _meta, ...rest } = raw;
    const config = createDefaultConfig(rest);
    const result = MonitorForgeConfigSchema.safeParse(config);
    expect(
      result.success,
      `Preset ${file} failed validation: ${JSON.stringify(result.error?.issues)}`,
    ).toBe(true);
  });

  it('has at least 15 presets', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(15);
  });

  it.each(presetFiles)('preset %s has at least 1 source', (file) => {
    const content = JSON.parse(readFileSync(resolve(presetsDir, file), 'utf-8'));
    // blank preset is allowed to have 0 sources
    if (basename(file, '.json') === 'blank') return;
    expect(content.sources?.length).toBeGreaterThanOrEqual(1);
  });
});
