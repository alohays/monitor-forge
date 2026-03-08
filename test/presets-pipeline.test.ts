import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitorForgeConfigSchema } from '../forge/src/config/schema.js';
import { createDefaultConfig } from '../forge/src/config/defaults.js';
import { generateManifests } from '../forge/src/generators/manifest-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetDir = resolve(__dirname, '../presets');
const presetFiles = readdirSync(presetDir).filter(f => f.endsWith('.json'));

// ─── Helpers ───────────────────────────────────────────────

function extractImportedClasses(code: string): string[] {
  return [...code.matchAll(/import\s*\{\s*(\w+)\s*\}/g)].map(m => m[1]);
}

function extractRegisteredClasses(code: string): string[] {
  return [...code.matchAll(/register\w+\([^,]+,\s*(\w+)\)/g)].map(m => m[1]);
}

function extractExportedJson(code: string, varName: string): unknown[] {
  const match = code.match(new RegExp(`export const ${varName}:\\s*\\w+\\[\\]\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!match) throw new Error(`Could not extract ${varName}`);
  return JSON.parse(match[1]);
}

// ─── Source type → class name mapping (mirrors manifest-generator.ts) ───

const sourceClassMap: Record<string, string> = {
  rss: 'RSSSource',
  'rest-api': 'APISource',
  websocket: 'WebSocketSource',
};

const panelClassMap: Record<string, string> = {
  'ai-brief': 'AIBriefPanel',
  'news-feed': 'NewsFeedPanel',
  'market-ticker': 'MarketTickerPanel',
  'entity-tracker': 'EntityTrackerPanel',
  'instability-index': 'InstabilityIndexPanel',
  'service-status': 'ServiceStatusPanel',
};

const layerClassMap: Record<string, string> = {
  points: 'PointsLayerPlugin',
  lines: 'LinesLayerPlugin',
  polygons: 'PolygonsLayerPlugin',
  heatmap: 'HeatmapLayerPlugin',
  hexagon: 'HexagonLayerPlugin',
};

// ─── Pipeline Tests ────────────────────────────────────────

describe.each(presetFiles)('preset pipeline: %s', (filename) => {
  const raw = JSON.parse(readFileSync(resolve(presetDir, filename), 'utf-8'));
  const config = createDefaultConfig(raw);
  const validated = MonitorForgeConfigSchema.parse(config);

  it('generates all 6 manifests without error', () => {
    const manifests = generateManifests(validated);
    expect(Object.keys(manifests)).toEqual([
      'source-manifest.ts',
      'layer-manifest.ts',
      'panel-manifest.ts',
      'config-resolved.ts',
      'view-manifest.ts',
      'theme-resolved.ts',
    ]);
    // Every manifest should be a non-empty string
    for (const [name, content] of Object.entries(manifests)) {
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('source manifest imports exactly the types used in preset', () => {
    const manifests = generateManifests(validated);
    const code = manifests['source-manifest.ts'];
    const usedTypes = new Set(validated.sources.map(s => s.type));
    const expectedClasses = [...usedTypes]
      .map(t => sourceClassMap[t])
      .filter(Boolean);

    const imported = extractImportedClasses(code).filter(c => c !== 'registerSource');
    const registered = extractRegisteredClasses(code);

    // Every expected class is imported and registered
    for (const cls of expectedClasses) {
      expect(imported).toContain(cls);
      expect(registered).toContain(cls);
    }

    // No extra classes imported beyond what's needed
    for (const cls of imported) {
      expect(expectedClasses).toContain(cls);
    }
  });

  it('panel manifest imports exactly the types used in preset', () => {
    const manifests = generateManifests(validated);
    const code = manifests['panel-manifest.ts'];
    const usedTypes = new Set(validated.panels.map(p => p.type));
    const expectedClasses = [...usedTypes]
      .filter(t => t !== 'custom')
      .map(t => panelClassMap[t])
      .filter(Boolean);

    const imported = extractImportedClasses(code).filter(c => c !== 'registerPanelType');
    const registered = extractRegisteredClasses(code);

    for (const cls of expectedClasses) {
      expect(imported).toContain(cls);
      expect(registered).toContain(cls);
    }
    for (const cls of imported) {
      expect(expectedClasses).toContain(cls);
    }
  });

  it('layer manifest imports exactly the types used in preset', () => {
    const manifests = generateManifests(validated);
    const code = manifests['layer-manifest.ts'];
    const usedTypes = new Set(validated.layers.map(l => l.type));
    const expectedClasses = [...usedTypes]
      .map(t => layerClassMap[t])
      .filter(Boolean);

    const imported = extractImportedClasses(code).filter(c => c !== 'registerLayerType');
    const registered = extractRegisteredClasses(code);

    for (const cls of expectedClasses) {
      expect(imported).toContain(cls);
      expect(registered).toContain(cls);
    }
    for (const cls of imported) {
      expect(expectedClasses).toContain(cls);
    }
  });

  it('generated sourceConfigs JSON has correct number of entries', () => {
    const manifests = generateManifests(validated);
    const code = manifests['source-manifest.ts'];
    const parsed = extractExportedJson(code, 'sourceConfigs') as Array<{ name: string }>;
    expect(parsed).toHaveLength(validated.sources.length);
    // Every source name from config exists in generated JSON
    const generatedNames = parsed.map(s => s.name);
    for (const source of validated.sources) {
      expect(generatedNames).toContain(source.name);
    }
  });

  it('generated panelConfigs JSON has correct number of entries', () => {
    const manifests = generateManifests(validated);
    const code = manifests['panel-manifest.ts'];
    const parsed = extractExportedJson(code, 'panelConfigs') as Array<{ name: string }>;
    expect(parsed).toHaveLength(validated.panels.length);
  });

  it('AI fallback chain references only defined providers', () => {
    if (!validated.ai.enabled || validated.ai.fallbackChain.length === 0) {
      return; // Skip for presets with AI disabled or empty chain
    }
    const definedProviders = Object.keys(validated.ai.providers);
    for (const providerName of validated.ai.fallbackChain) {
      expect(definedProviders).toContain(providerName);
    }
  });
});
