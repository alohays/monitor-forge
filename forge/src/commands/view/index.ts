import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { ViewSchema } from '../../config/schema.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

export function registerViewCommands(program: Command): void {
  const view = program.command('view').description('Manage dashboard views');

  view
    .command('add <name>')
    .description('Add a dashboard view grouping panels into a tab')
    .requiredOption('--display-name <displayName>', 'Display name in tab UI')
    .requiredOption('--panels <panels>', 'Comma-separated panel names')
    .option('--icon <icon>', 'Icon or emoji for the tab')
    .option('--default', 'Set as the default view')
    .action((name, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const panelNames = opts.panels.split(',').map((s: string) => s.trim()).filter(Boolean);

        const viewConfig = ViewSchema.parse({
          name,
          displayName: opts.displayName,
          panels: panelNames,
          icon: opts.icon,
          default: opts.default || undefined,
        });

        // Validate panel names exist in config
        const config = loadConfig();
        const existingPanels = new Set(config.panels.map(p => p.name));
        const unknownPanels = panelNames.filter((p: string) => !existingPanels.has(p));
        if (unknownPanels.length > 0) {
          throw new Error(`Unknown panel(s): ${unknownPanels.join(', ')}. Available: ${Array.from(existingPanels).join(', ')}`);
        }

        if (dryRun) {
          console.log(formatOutput(
            success('view add --dry-run', viewConfig, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would add view "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const { path } = updateConfig(cfg => {
          if (cfg.views.some(v => v.name === name)) {
            throw new Error(`View "${name}" already exists`);
          }

          const views = [...cfg.views];

          // If --default, clear default from other views
          if (opts.default) {
            for (const v of views) {
              delete v.default;
            }
          }

          views.push(viewConfig);
          return { ...cfg, views };
        });

        console.log(formatOutput(
          success('view add', viewConfig, {
            changes: [{ type: 'modified', file: path, description: `Added view "${name}"` }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('view add', String(err)), format));
        process.exit(1);
      }
    });

  view
    .command('remove <name>')
    .description('Remove a dashboard view (panels are NOT deleted)')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('view remove --dry-run', { name }, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would remove view "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          const filtered = cfg.views.filter(v => v.name !== name);
          if (filtered.length === cfg.views.length) {
            throw new Error(`View "${name}" not found`);
          }
          return { ...cfg, views: filtered };
        });

        console.log(formatOutput(
          success('view remove', { name, remaining: config.views.length }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('view remove', String(err)), format));
        process.exit(1);
      }
    });

  view
    .command('list')
    .description('List all configured dashboard views')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const views = config.views.map(v => ({
          name: v.name,
          displayName: v.displayName,
          panels: v.panels.join(', '),
          default: v.default ? 'yes' : '',
        }));
        console.log(formatOutput(success('view list', views), format));
      } catch (err) {
        console.log(formatOutput(failure('view list', String(err)), format));
        process.exit(1);
      }
    });

  view
    .command('set-default <name>')
    .description('Set the default view')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('view set-default --dry-run', { name }, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would set "${name}" as default view` }],
            }),
            format,
          ));
          return;
        }

        const { path } = updateConfig(cfg => {
          if (!cfg.views.some(v => v.name === name)) {
            throw new Error(`View "${name}" not found`);
          }
          const views = cfg.views.map(v => {
            const copy = { ...v };
            if (v.name === name) {
              copy.default = true;
            } else {
              delete copy.default;
            }
            return copy;
          });
          return { ...cfg, views };
        });

        console.log(formatOutput(
          success('view set-default', { name }, {
            changes: [{ type: 'modified', file: path, description: `Set "${name}" as default view` }],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('view set-default', String(err)), format));
        process.exit(1);
      }
    });
}
