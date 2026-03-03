import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { SourceSchema, type SourceConfig } from '../../config/schema.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

export function registerSourceCommands(program: Command): void {
  const source = program.command('source').description('Manage data sources');

  source
    .command('add <type>')
    .description('Add a data source (rss, rest-api, websocket)')
    .requiredOption('--name <name>', 'Unique source name (lowercase, hyphens)')
    .requiredOption('--url <url>', 'Source URL')
    .requiredOption('--category <category>', 'Category for grouping')
    .option('--tier <tier>', 'Authority tier 1-4 (1=official, 4=unverified)', '3')
    .option('--interval <seconds>', 'Refresh interval in seconds', '300')
    .option('--language <lang>', 'Language code', 'en')
    .option('--tags <tags...>', 'Tags for filtering')
    .option('--headers <json>', 'JSON object of HTTP headers')
    .option('--transform <path>', 'JSONPath-like transform expression')
    .action((type, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const sourceConfig: SourceConfig = SourceSchema.parse({
          name: opts.name,
          type,
          url: opts.url,
          category: opts.category,
          tier: parseInt(opts.tier, 10),
          interval: parseInt(opts.interval, 10),
          language: opts.language,
          tags: opts.tags ?? [],
          headers: opts.headers ? JSON.parse(opts.headers) : undefined,
          transform: opts.transform,
        });

        if (dryRun) {
          console.log(formatOutput(
            success('source add --dry-run', sourceConfig, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.ts', description: `Would add source "${opts.name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          if (cfg.sources.some(s => s.name === opts.name)) {
            throw new Error(`Source "${opts.name}" already exists`);
          }
          return { ...cfg, sources: [...cfg.sources, sourceConfig] };
        });

        console.log(formatOutput(
          success('source add', sourceConfig, {
            changes: [{ type: 'modified', file: path, description: `Added source "${opts.name}"` }],
            next_steps: ['forge validate', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('source add', String(err)), format));
        process.exit(1);
      }
    });

  source
    .command('remove <name>')
    .description('Remove a data source')
    .action((name) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('source remove --dry-run', { name }, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.ts', description: `Would remove source "${name}"` }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          const filtered = cfg.sources.filter(s => s.name !== name);
          if (filtered.length === cfg.sources.length) {
            throw new Error(`Source "${name}" not found`);
          }
          return { ...cfg, sources: filtered };
        });

        console.log(formatOutput(
          success('source remove', { name, remaining: config.sources.length }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('source remove', String(err)), format));
        process.exit(1);
      }
    });

  source
    .command('list')
    .description('List all configured data sources')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const sources = config.sources.map(s => ({
          name: s.name,
          type: s.type,
          category: s.category,
          url: s.url,
          interval: `${s.interval}s`,
          tier: s.tier,
        }));
        console.log(formatOutput(success('source list', sources), format));
      } catch (err) {
        console.log(formatOutput(failure('source list', String(err)), format));
        process.exit(1);
      }
    });
}
