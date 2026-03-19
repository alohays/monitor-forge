import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MonitorForgeConfigSchema, type MonitorForgeConfig } from './schema.js';

const CONFIG_JSON = 'monitor-forge.config.json';
const CONFIG_TS = 'monitor-forge.config.ts';

function getJsonPath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), CONFIG_JSON);
}

function getTsPath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), CONFIG_TS);
}

export function configExists(cwd?: string): boolean {
  return existsSync(getJsonPath(cwd));
}

export function loadConfig(cwd?: string): MonitorForgeConfig {
  const jsonPath = getJsonPath(cwd);
  if (!existsSync(jsonPath)) {
    throw new Error(`Config file not found: ${jsonPath}. Run "forge init" first.`);
  }
  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw);

  // Backfill version for pre-v0.3.0 configs
  if (!parsed.version) {
    console.warn('Warning: Config file has no "version" field. Backfilling to "1". Run `forge validate` to check your config.');
    parsed.version = '1';
  }

  return MonitorForgeConfigSchema.parse(parsed);
}

export function writeConfig(config: MonitorForgeConfig, cwd?: string): string {
  const jsonPath = getJsonPath(cwd);
  const tsPath = getTsPath(cwd);

  // Write JSON (source of truth)
  writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  // Write TS wrapper (for import in app code)
  const tsContent = `// This file is auto-generated from monitor-forge.config.json
// Edit via forge CLI or modify the JSON file directly.
import config from './monitor-forge.config.json' with { type: 'json' };
export default config;
`;
  writeFileSync(tsPath, tsContent, 'utf-8');

  return jsonPath;
}

export function updateConfig(
  updater: (config: MonitorForgeConfig) => MonitorForgeConfig,
  cwd?: string,
): { config: MonitorForgeConfig; path: string } {
  const current = loadConfig(cwd);
  const updated = updater(current);
  MonitorForgeConfigSchema.parse(updated);
  const path = writeConfig(updated, cwd);
  return { config: updated, path };
}
