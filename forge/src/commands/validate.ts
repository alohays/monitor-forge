import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate the monitor-forge configuration')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const warnings: string[] = [];
      const errors: string[] = [];

      try {
        const config = loadConfig();

        // Check sources
        if (config.sources.length === 0) {
          warnings.push('No data sources configured. Run `forge source add` to add feeds.');
        }

        // Check panels
        if (config.panels.length === 0) {
          warnings.push('No panels configured. Run `forge panel add` to add UI panels.');
        }

        // Check for duplicate names
        const sourceNames = config.sources.map(s => s.name);
        const dupes = sourceNames.filter((n, i) => sourceNames.indexOf(n) !== i);
        if (dupes.length > 0) {
          errors.push(`Duplicate source names: ${dupes.join(', ')}`);
        }

        const layerNames = config.layers.map(l => l.name);
        const layerDupes = layerNames.filter((n, i) => layerNames.indexOf(n) !== i);
        if (layerDupes.length > 0) {
          errors.push(`Duplicate layer names: ${layerDupes.join(', ')}`);
        }

        const panelNames = config.panels.map(p => p.name);
        const panelDupes = panelNames.filter((n, i) => panelNames.indexOf(n) !== i);
        if (panelDupes.length > 0) {
          errors.push(`Duplicate panel names: ${panelDupes.join(', ')}`);
        }

        // Check static layer data files exist
        for (const layer of config.layers) {
          if (layer.data.source === 'static' && layer.data.path) {
            const dataPath = resolve(process.cwd(), layer.data.path);
            if (!existsSync(dataPath)) {
              errors.push(`Layer "${layer.name}" references missing file: ${layer.data.path}`);
            }
          }
        }

        // Check source-ref layers point to valid sources
        for (const layer of config.layers) {
          if (layer.data.source === 'source-ref' && layer.data.sourceRef) {
            if (!config.sources.some(s => s.name === layer.data.sourceRef)) {
              errors.push(`Layer "${layer.name}" references unknown source: ${layer.data.sourceRef}`);
            }
          }
        }

        // Check panel source refs
        for (const panel of config.panels) {
          const panelSource = (panel.config as Record<string, unknown>).source;
          if (typeof panelSource === 'string') {
            if (!config.sources.some(s => s.name === panelSource)) {
              warnings.push(`Panel "${panel.name}" references source "${panelSource}" which is not configured`);
            }
          }
        }

        // Check AI providers
        if (config.ai.enabled) {
          if (Object.keys(config.ai.providers).length === 0) {
            warnings.push('AI is enabled but no providers configured. Run `forge ai configure`.');
          }
          for (const providerName of config.ai.fallbackChain) {
            if (!config.ai.providers[providerName]) {
              errors.push(`AI fallback chain references unknown provider: ${providerName}`);
            }
          }
        }

        if (errors.length > 0) {
          const output = failure('validate', `${errors.length} error(s) found`, warnings);
          (output as Record<string, unknown>).data = { errors, warnings };
          console.log(formatOutput(output, format));
          if (format !== 'json') {
            for (const e of errors) console.log(`  ERROR: ${e}`);
          }
          process.exit(1);
        }

        console.log(formatOutput(
          success('validate', {
            valid: true,
            sources: config.sources.length,
            layers: config.layers.length,
            panels: config.panels.length,
            aiEnabled: config.ai.enabled,
            warnings: warnings.length,
          }, { warnings }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('validate', String(err)), format));
        process.exit(1);
      }
    });
}
