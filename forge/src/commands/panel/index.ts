import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { PanelSchema, type PanelConfig } from '../../config/schema.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

export function registerPanelCommands(program: Command): void {
  const panel = program.command('panel').description('Manage UI panels');

  panel
    .command('add <type>')
    .description('Add a UI panel (ai-brief, news-feed, market-ticker, entity-tracker, instability-index, service-status, custom)')
    .requiredOption('--name <name>', 'Unique panel name (lowercase, hyphens)')
    .requiredOption('--display-name <displayName>', 'Display name in UI')
    .option('--position <pos>', 'Panel position (0-based)', '0')
    .option('--source <source>', 'Data source reference')
    .option('--config-json <json>', 'Panel-specific config as JSON')
    .action((type, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const panelSpecificConfig: Record<string, unknown> = opts.configJson
          ? JSON.parse(opts.configJson)
          : {};

        if (opts.source) {
          panelSpecificConfig.source = opts.source;
        }

        const panelConfig: PanelConfig = PanelSchema.parse({
          name: opts.name,
          type,
          displayName: opts.displayName,
          position: parseInt(opts.position, 10),
          config: panelSpecificConfig,
        });

        if (dryRun) {
          console.log(formatOutput(
            success('panel add --dry-run', panelConfig, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.ts', description: `Would add panel "${opts.name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          if (cfg.panels.some(p => p.name === opts.name)) {
            throw new Error(`Panel "${opts.name}" already exists`);
          }
          return { ...cfg, panels: [...cfg.panels, panelConfig] };
        });

        console.log(formatOutput(
          success('panel add', panelConfig, {
            changes: [{ type: 'modified', file: path, description: `Added panel "${opts.name}"` }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('panel add', String(err)), format));
        process.exit(1);
      }
    });

  panel
    .command('remove <name>')
    .description('Remove a UI panel')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('panel remove --dry-run', { name }, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.ts', description: `Would remove panel "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          const filtered = cfg.panels.filter(p => p.name !== name);
          if (filtered.length === cfg.panels.length) {
            throw new Error(`Panel "${name}" not found`);
          }
          return { ...cfg, panels: filtered };
        });

        console.log(formatOutput(
          success('panel remove', { name, remaining: config.panels.length }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('panel remove', String(err)), format));
        process.exit(1);
      }
    });

  panel
    .command('list')
    .description('List all configured UI panels')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const panels = config.panels.map(p => ({
          name: p.name,
          type: p.type,
          displayName: p.displayName,
          position: p.position,
        }));
        console.log(formatOutput(success('panel list', panels), format));
      } catch (err) {
        console.log(formatOutput(failure('panel list', String(err)), format));
        process.exit(1);
      }
    });
}
