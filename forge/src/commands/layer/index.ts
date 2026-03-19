import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { LayerSchema, type LayerConfig } from '../../config/schema.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

export function registerLayerCommands(program: Command): void {
  const layer = program.command('layer').description('Manage map layers');

  layer
    .command('add <type>')
    .description('Add a map layer (points, lines, polygons, heatmap, hexagon)')
    .requiredOption('--name <name>', 'Unique layer name (lowercase, hyphens)')
    .requiredOption('--display-name <displayName>', 'Display name in UI')
    .option('--color <color>', 'Hex color code', '#0052CC')
    .option('--icon <icon>', 'Icon name')
    .option('--data-path <path>', 'Path to static GeoJSON file')
    .option('--data-url <url>', 'URL for dynamic data')
    .option('--source-ref <ref>', 'Reference to a configured data source')
    .option('--default-visible', 'Show layer by default', false)
    .option('--category <category>', 'Layer category', 'general')
    .action((type, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const dataSource = opts.dataPath ? 'static' as const
          : opts.dataUrl ? 'api' as const
          : opts.sourceRef ? 'source-ref' as const
          : 'static' as const;

        const layerConfig: LayerConfig = LayerSchema.parse({
          name: opts.name,
          type,
          displayName: opts.displayName,
          color: opts.color,
          icon: opts.icon,
          data: {
            source: dataSource,
            path: opts.dataPath,
            url: opts.dataUrl,
            sourceRef: opts.sourceRef,
          },
          defaultVisible: opts.defaultVisible ?? false,
          category: opts.category,
        });

        if (dryRun) {
          console.log(formatOutput(
            success('layer add --dry-run', layerConfig, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would add layer "${opts.name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          if (cfg.layers.some(l => l.name === opts.name)) {
            throw new Error(`Layer "${opts.name}" already exists`);
          }
          return { ...cfg, layers: [...cfg.layers, layerConfig] };
        });

        console.log(formatOutput(
          success('layer add', layerConfig, {
            changes: [{ type: 'modified', file: path, description: `Added layer "${opts.name}"` }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('layer add', String(err)), format));
        process.exit(1);
      }
    });

  layer
    .command('remove <name>')
    .description('Remove a map layer')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('layer remove --dry-run', { name }, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would remove layer "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          const filtered = cfg.layers.filter(l => l.name !== name);
          if (filtered.length === cfg.layers.length) {
            throw new Error(`Layer "${name}" not found`);
          }
          return { ...cfg, layers: filtered };
        });

        console.log(formatOutput(
          success('layer remove', { name, remaining: config.layers.length }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('layer remove', String(err)), format));
        process.exit(1);
      }
    });

  layer
    .command('list')
    .description('List all configured map layers')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const layers = config.layers.map(l => ({
          name: l.name,
          type: l.type,
          displayName: l.displayName,
          color: l.color,
          visible: l.defaultVisible ? 'yes' : 'no',
          category: l.category,
        }));
        console.log(formatOutput(success('layer list', layers), format));
      } catch (err) {
        console.log(formatOutput(failure('layer list', String(err)), format));
        process.exit(1);
      }
    });
}
