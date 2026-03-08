import type { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { PanelSchema, type PanelConfig } from '../../config/schema.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

function toPascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function generatePanelScaffold(className: string, displayName: string): string {
  return `import { PanelBase } from '../core/panels/PanelBase.js';
import type { PanelConfig } from '../core/panels/PanelBase.js';

/**
 * Custom panel: ${displayName}
 *
 * Implement render(), update(), and destroy().
 * PanelBase utilities: triggerPulse(), showSkeleton(), hideSkeleton(),
 * markDataReceived(), createElement(tag, className?, innerHTML?)
 */
export class ${className} extends PanelBase {
  render(): void {
    this.container.innerHTML = '<p>${displayName} — edit src/custom-panels/${className}.ts</p>';
    this.showSkeleton();
  }

  update(data: unknown): void {
    this.markDataReceived();
  }

  destroy(): void {
    this.cleanupTimers();
    this.container.innerHTML = '';
  }
}
`;
}

export function registerPanelCommands(program: Command): void {
  const panel = program.command('panel').description('Manage UI panels');

  panel
    .command('create <name>')
    .description('Scaffold a new custom panel in src/custom-panels/')
    .option('--display-name <displayName>', 'Display name in UI')
    .option('--position <pos>', 'Panel position (0-based)')
    .option('--no-register', 'Only scaffold the file, skip config registration')
    .action((name, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const className = toPascalCase(name);
        const displayName = opts.displayName ?? name.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        const customDir = resolve(process.cwd(), 'src/custom-panels');
        const filePath = resolve(customDir, `${className}.ts`);

        if (existsSync(filePath)) {
          throw new Error(`Custom panel file already exists: src/custom-panels/${className}.ts`);
        }

        if (dryRun) {
          console.log(formatOutput(
            success('panel create --dry-run', { name, className, filePath: `src/custom-panels/${className}.ts` }, {
              changes: [
                { type: 'created', file: `src/custom-panels/${className}.ts`, description: `Would scaffold custom panel "${name}"` },
                ...(opts.register !== false ? [{ type: 'modified' as const, file: 'monitor-forge.config.json', description: `Would add panel "${name}" to config` }] : []),
              ],
            }),
            format,
          ));
          return;
        }

        // Create directory and scaffold file
        mkdirSync(customDir, { recursive: true });
        writeFileSync(filePath, generatePanelScaffold(className, displayName));

        const changes: Array<{ type: 'created' | 'modified' | 'deleted'; file: string; description: string }> = [
          { type: 'created', file: `src/custom-panels/${className}.ts`, description: `Scaffolded custom panel "${name}"` },
        ];

        // Register in config unless --no-register
        if (opts.register !== false) {
          const config = loadConfig();
          const position = opts.position != null
            ? parseInt(opts.position, 10)
            : Math.max(0, ...config.panels.map(p => p.position)) + 1;

          const panelConfig: PanelConfig = PanelSchema.parse({
            name,
            type: 'custom',
            displayName,
            position,
            config: {},
            customModule: className,
          });

          const { path } = updateConfig(cfg => {
            if (cfg.panels.some(p => p.name === name)) {
              throw new Error(`Panel "${name}" already exists in config`);
            }
            return { ...cfg, panels: [...cfg.panels, panelConfig] };
          });

          changes.push({ type: 'modified' as const, file: path, description: `Added panel "${name}" to config` });
        }

        console.log(formatOutput(
          success('panel create', { name, className, file: `src/custom-panels/${className}.ts` }, {
            changes,
            next_steps: ['Edit the scaffold file', 'forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('panel create', String(err)), format));
        process.exit(1);
      }
    });

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
