import type { Command } from 'commander';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { configExists, writeConfig } from '../config/loader.js';
import { createDefaultConfig } from '../config/defaults.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerPresetCommands(program: Command): void {
  const preset = program.command('preset').description('Manage dashboard presets');

  preset
    .command('list')
    .description('List available presets')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const presetsDir = resolve(process.cwd(), 'presets');

      if (!existsSync(presetsDir)) {
        console.log(formatOutput(success('preset list', []), format));
        return;
      }

      const files = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
      const presets = files.map(f => {
        const content = JSON.parse(readFileSync(resolve(presetsDir, f), 'utf-8'));
        const meta = content._meta ?? {};
        return {
          name: basename(f, '.json'),
          domain: content.monitor?.domain ?? 'general',
          sources: content.sources?.length ?? 0,
          layers: content.layers?.length ?? 0,
          panels: content.panels?.length ?? 0,
          category: meta.category ?? content.monitor?.domain ?? 'general',
          difficulty: meta.difficulty ?? '-',
          description: meta.preview_description ?? content.monitor?.description ?? '',
        };
      });

      console.log(formatOutput(success('preset list', presets), format));
    });

  preset
    .command('apply <name>')
    .description('Apply a preset to the current configuration')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const presetPath = resolve(process.cwd(), 'presets', `${name}.json`);
        if (!existsSync(presetPath)) {
          console.log(formatOutput(failure('preset apply', `Preset "${name}" not found`), format));
          process.exit(1);
        }

        const presetData = JSON.parse(readFileSync(presetPath, 'utf-8'));
        const config = createDefaultConfig(presetData);

        if (dryRun) {
          console.log(formatOutput(
            success('preset apply --dry-run', config, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would apply preset "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const path = writeConfig(config);

        console.log(formatOutput(
          success('preset apply', {
            preset: name,
            sources: config.sources.length,
            layers: config.layers.length,
            panels: config.panels.length,
          }, {
            changes: [{ type: 'modified', file: path, description: `Applied preset "${name}"` }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('preset apply', String(err)), format));
        process.exit(1);
      }
    });
}
