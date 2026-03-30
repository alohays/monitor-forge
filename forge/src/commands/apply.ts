import type { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { loadConfig, writeConfig } from '../config/loader.js';
import { MonitorForgeConfigSchema } from '../config/schema.js';
import { mergeConfig } from '../config/merge.js';
import { formatOutput, success, structuredFailure, type OutputFormat } from '../output/format.js';

function readStdin(): Promise<string> {
  return new Promise((res, rej) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => res(data));
    process.stdin.on('error', rej);
  });
}

export function registerApplyCommand(program: Command): void {
  program
    .command('apply <file>')
    .description('Apply a declarative patch to the current configuration')
    .option('--force', 'Skip confirmation in interactive mode', false)
    .action(async (file, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        // Read patch from file or stdin
        let patchRaw: string;
        if (file === '-') {
          patchRaw = await readStdin();
        } else {
          const filePath = resolve(process.cwd(), file);
          if (!existsSync(filePath)) {
            console.log(formatOutput(
              structuredFailure('apply', new Error(`Patch file not found: ${filePath}`)),
              format,
            ));
            process.exit(1);
          }
          patchRaw = readFileSync(filePath, 'utf-8');
        }

        // Parse the patch JSON
        let patch: Record<string, unknown>;
        try {
          patch = JSON.parse(patchRaw);
        } catch {
          console.log(formatOutput(
            structuredFailure('apply', new Error('Invalid JSON in patch file')),
            format,
          ));
          process.exit(1);
        }

        if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
          console.log(formatOutput(
            structuredFailure('apply', new Error('Patch must be a JSON object')),
            format,
          ));
          process.exit(1);
        }

        // Load current config
        const currentConfig = loadConfig();

        // Merge
        const { config: merged, changes } = mergeConfig(currentConfig, patch);

        // Validate merged config
        let validated;
        try {
          validated = MonitorForgeConfigSchema.parse(merged);
        } catch (err) {
          if (err instanceof ZodError) {
            console.log(formatOutput(
              structuredFailure('apply', err),
              format,
            ));
            process.exit(1);
          }
          throw err;
        }

        // Dry-run mode
        if (dryRun) {
          console.log(formatOutput(
            success('apply --dry-run', {
              changes: changes.map(c => ({
                type: c.type,
                path: c.path,
                ...(c.name ? { name: c.name } : {}),
              })),
              totalChanges: changes.length,
            }, {
              changes: [{
                type: 'modified',
                file: 'monitor-forge.config.json',
                description: `Would apply ${changes.length} change(s)`,
              }],
            }),
            format,
          ));
          return;
        }

        // Write merged config
        const path = writeConfig(validated);

        console.log(formatOutput(
          success('apply', {
            changes: changes.map(c => ({
              type: c.type,
              path: c.path,
              ...(c.name ? { name: c.name } : {}),
            })),
            totalChanges: changes.length,
          }, {
            changes: [{
              type: 'modified',
              file: path,
              description: `Applied ${changes.length} change(s)`,
            }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(
          structuredFailure('apply', err instanceof Error ? err : String(err)),
          format,
        ));
        process.exit(1);
      }
    });
}
