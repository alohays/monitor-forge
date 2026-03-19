import type { Command } from 'commander';
import { ZodError } from 'zod';
import { loadConfig, updateConfig } from '../config/loader.js';
import { MonitorForgeConfigSchema } from '../config/schema.js';
import { formatOutput, success, structuredFailure, type OutputFormat } from '../output/format.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function validatePathSegments(path: string): string[] {
  const keys = path.split('.');
  if (keys.some(k => FORBIDDEN_KEYS.has(k))) {
    throw new Error(`Invalid path "${path}": contains reserved key segment`);
  }
  return keys;
}

function getByPath(obj: unknown, path: string): unknown {
  const keys = validatePathSegments(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = validatePathSegments(path);
  const result = structuredClone(obj);
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function detectStrippedKeys(before: Record<string, unknown>, after: Record<string, unknown>, path: string): string[] {
  const stripped: string[] = [];
  for (const key of Object.keys(before)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (!(key in after)) {
      stripped.push(fullPath);
    } else if (
      typeof before[key] === 'object' && before[key] !== null &&
      typeof after[key] === 'object' && after[key] !== null &&
      !Array.isArray(before[key])
    ) {
      stripped.push(
        ...detectStrippedKeys(
          before[key] as Record<string, unknown>,
          after[key] as Record<string, unknown>,
          fullPath,
        ),
      );
    }
  }
  return stripped;
}

export function registerConfigCommands(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Read and write config values by dot-path');

  configCmd
    .command('get <path>')
    .description('Get a config value by dot-notation path (e.g., monitor.name, map.zoom)')
    .action(async (dotPath: string) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const value = getByPath(config, dotPath);
        if (value === undefined) {
          console.log(formatOutput(
            structuredFailure('config get', `Path "${dotPath}" not found in config`),
            format,
          ));
          process.exit(1);
        }
        console.log(formatOutput(
          success('config get', { path: dotPath, value }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(
          structuredFailure('config get', err instanceof Error ? err : String(err)),
          format,
        ));
        process.exit(1);
      }
    });

  configCmd
    .command('set <path> <value>')
    .description('Set a config value by dot-notation path (e.g., monitor.name "My Dashboard")')
    .action(async (dotPath: string, rawValue: string) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const value = parseValue(rawValue);
        const config = loadConfig();
        const updated = setByPath(config as unknown as Record<string, unknown>, dotPath, value);

        // Validate through Zod
        let validated;
        try {
          validated = MonitorForgeConfigSchema.parse(updated);
        } catch (err) {
          if (err instanceof ZodError) {
            console.log(formatOutput(
              structuredFailure('config set', err),
              format,
            ));
            process.exit(1);
          }
          throw err;
        }

        // Detect keys stripped by Zod (unknown paths)
        const warnings: string[] = [];
        const strippedKeys = detectStrippedKeys(updated, validated as unknown as Record<string, unknown>, '');
        if (strippedKeys.length > 0) {
          for (const key of strippedKeys) {
            warnings.push(`Key "${key}" was stripped during validation — it may not be a valid config path.`);
          }
        }

        if (dryRun) {
          console.log(formatOutput(
            success('config set --dry-run', { path: dotPath, value, validated: true }, { warnings }),
            format,
          ));
          return;
        }

        updateConfig(() => validated);

        console.log(formatOutput(
          success('config set', { path: dotPath, value }, {
            changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Set ${dotPath} = ${JSON.stringify(value)}` }],
            warnings,
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(
          structuredFailure('config set', err instanceof Error ? err : String(err)),
          format,
        ));
        process.exit(1);
      }
    });
}
