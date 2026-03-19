import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { ZodError } from 'zod';
import { formatOutput, success, failure, structuredFailure, type OutputFormat } from '../output/format.js';

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

        // Check views
        if (config.views.length > 0) {
          const viewNames = config.views.map(v => v.name);
          const viewDupes = viewNames.filter((n, i) => viewNames.indexOf(n) !== i);
          if (viewDupes.length > 0) {
            errors.push(`Duplicate view names: ${viewDupes.join(', ')}`);
          }

          for (const view of config.views) {
            for (const panelName of view.panels) {
              if (!panelNames.includes(panelName)) {
                errors.push(`View "${view.name}" references unknown panel: "${panelName}"`);
              }
            }
          }

          const defaults = config.views.filter(v => v.default);
          if (defaults.length > 1) {
            errors.push(`Multiple views marked as default: ${defaults.map(v => v.name).join(', ')}. At most one allowed.`);
          }

          // Warn about orphan panels not in any view
          const viewedPanels = new Set(config.views.flatMap(v => v.panels));
          for (const panel of config.panels) {
            if (!viewedPanels.has(panel.name)) {
              warnings.push(`Panel "${panel.name}" is not included in any view`);
            }
          }
        }

        // Check custom panels have customModule
        for (const panel of config.panels) {
          if (panel.type === 'custom' && !panel.customModule) {
            errors.push(`Custom panel "${panel.name}" is missing customModule field — build will fail at runtime`);
          }
        }

        // Check proxy security
        if (config.backend.corsProxy.enabled) {
          const domains = config.backend.corsProxy.allowedDomains;
          if (domains.length === 1 && domains[0] === '*') {
            warnings.push(
              'Proxy allowedDomains is wildcard ["*"]. Consider listing specific domains in ' +
              'corsProxy.allowedDomains, or add sources so forge build can auto-generate the allowlist.',
            );
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
          (output as unknown as Record<string, unknown>).data = { errors, warnings };
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
            views: config.views.length,
            aiEnabled: config.ai.enabled,
            warnings: warnings.length,
          }, { warnings }),
          format,
        ));
      } catch (err) {
        if (err instanceof ZodError) {
          console.log(formatOutput(
            structuredFailure('validate', 'Config validation failed', { zodError: err }),
            format,
          ));
        } else {
          console.log(formatOutput(
            structuredFailure('validate', err instanceof Error ? err : String(err)),
            format,
          ));
        }
        process.exit(1);
      }
    });
}
