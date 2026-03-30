import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { SourceSchema, type SourceConfig } from '../../config/schema.js';
import { formatOutput, success, failure, structuredFailure, type OutputFormat } from '../../output/format.js';
import {
  findLibraryEntry,
  findApiTemplate,
  libraryEntryToSourceConfig,
  templateToSourceConfig,
  filterLibrary,
  filterTemplates,
} from './library.js';

function addSourceToConfig(
  sourceConfig: SourceConfig,
  upsert: boolean,
  dryRun: boolean,
  format: OutputFormat,
  command: string,
  warnings: string[] = [],
): void {
  if (dryRun) {
    let dryRunAction = 'add';
    try {
      const existingConfig = loadConfig();
      if (existingConfig.sources.some(s => s.name === sourceConfig.name)) {
        dryRunAction = upsert ? 'update' : 'fail (duplicate, use --upsert)';
      }
    } catch {
      // Config may not exist in dry-run context
    }
    console.log(formatOutput(
      success(`${command} --dry-run`, { ...sourceConfig, action: dryRunAction }, {
        changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would ${dryRunAction} source "${sourceConfig.name}"` }],
        warnings,
      }),
      format,
    ));
    return;
  }

  let action = 'created' as string;

  const { config, path } = updateConfig(cfg => {
    const existingIdx = cfg.sources.findIndex(s => s.name === sourceConfig.name);
    if (existingIdx >= 0) {
      if (!upsert) {
        throw new Error(`Source "${sourceConfig.name}" already exists`);
      }
      action = 'updated';
      const sources = [...cfg.sources];
      sources[existingIdx] = sourceConfig;
      return { ...cfg, sources };
    }
    return { ...cfg, sources: [...cfg.sources, sourceConfig] };
  });

  console.log(formatOutput(
    success(command, { ...sourceConfig, action }, {
      changes: [{ type: 'modified', file: path, description: `${action === 'updated' ? 'Updated' : 'Added'} source "${sourceConfig.name}"` }],
      warnings,
      next_steps: ['forge validate', 'forge dev'],
    }),
    format,
  ));
}

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
    .option('--upsert', 'Update if source already exists, create if not')
    .option('--from-library <ids>', 'Add RSS feed(s) from library by ID (comma-separated)')
    .option('--from-template <id>', 'Add API source from template by ID')
    .option('--include-unverified', 'Allow adding unverified feeds from library')
    .action((type, opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        // --from-library mode: batch add RSS feeds from library
        if (opts.fromLibrary) {
          const ids = opts.fromLibrary.split(',').map((id: string) => id.trim()).filter(Boolean);
          const results: Array<{ id: string; success: boolean; error?: string }> = [];
          const warnings: string[] = [];

          for (const id of ids) {
            try {
              const entry = findLibraryEntry(id);
              if (!entry) {
                results.push({ id, success: false, error: `Feed "${id}" not found in library` });
                continue;
              }
              if (!entry.verified && !opts.includeUnverified) {
                results.push({ id, success: false, error: `Feed "${id}" is unverified. Use --include-unverified to add it.` });
                continue;
              }

              const base = libraryEntryToSourceConfig(entry);
              // Allow CLI overrides
              if (opts.category) base.category = opts.category;
              if (opts.tier) base.tier = parseInt(opts.tier, 10);
              if (opts.interval) base.interval = parseInt(opts.interval, 10);
              if (opts.language) base.language = opts.language;
              if (opts.tags) base.tags = opts.tags;

              const sourceConfig = SourceSchema.parse(base);
              addSourceToConfig(sourceConfig, opts.upsert ?? false, dryRun, format, 'source add --from-library');
              results.push({ id, success: true });
            } catch (err) {
              results.push({ id, success: false, error: err instanceof Error ? err.message : String(err) });
            }
          }

          const succeeded = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success);

          if (failed.length > 0) {
            for (const f of failed) {
              warnings.push(`${f.id}: ${f.error}`);
            }
          }

          if (ids.length > 1) {
            console.log(formatOutput(
              success('source add --from-library', {
                total: ids.length,
                succeeded,
                failed: failed.length,
                errors: failed.map(f => ({ id: f.id, error: f.error })),
              }, { warnings }),
              format,
            ));
          }

          if (failed.length > 0 && succeeded === 0) {
            process.exit(1);
          }
          return;
        }

        // --from-template mode: add API source from template
        if (opts.fromTemplate) {
          const template = findApiTemplate(opts.fromTemplate);
          if (!template) {
            console.log(formatOutput(
              structuredFailure('source add --from-template', new Error(`Template "${opts.fromTemplate}" not found`)),
              format,
            ));
            process.exit(1);
            return;
          }

          const warnings: string[] = [];
          if (template.authType !== 'none' && template.authEnvVar) {
            warnings.push(`Template requires ${template.authType} auth. Set env var: ${template.authEnvVar}`);
          }

          const base = templateToSourceConfig(template);
          // Allow CLI overrides
          if (opts.category) base.category = opts.category;
          if (opts.tier) base.tier = parseInt(opts.tier, 10);
          if (opts.interval) base.interval = parseInt(opts.interval, 10);

          const sourceConfig = SourceSchema.parse(base);
          addSourceToConfig(sourceConfig, opts.upsert ?? false, dryRun, format, 'source add --from-template', warnings);
          return;
        }

        // Standard add mode
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

        addSourceToConfig(sourceConfig, opts.upsert ?? false, dryRun, format, 'source add');
      } catch (err) {
        console.log(formatOutput(structuredFailure('source add', err instanceof Error ? err : String(err)), format));
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
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: `Would remove source "${name}"` }],
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
        console.log(formatOutput(structuredFailure('source remove', err instanceof Error ? err : String(err)), format));
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
        console.log(formatOutput(structuredFailure('source list', err instanceof Error ? err : String(err)), format));
        process.exit(1);
      }
    });

  source
    .command('list-library')
    .description('List all feeds from the RSS feed library')
    .option('--category <category>', 'Filter by category')
    .option('--language <language>', 'Filter by language')
    .option('--tier <tier>', 'Filter by tier')
    .action((opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const entries = filterLibrary({
          category: opts.category,
          language: opts.language,
          tier: opts.tier ? parseInt(opts.tier, 10) : undefined,
        });
        const rows = entries.map(e => ({
          id: e.id,
          name: e.name,
          category: e.category,
          tier: e.tier,
          language: e.language,
          propagandaRisk: e.propagandaRisk,
          verified: e.verified,
        }));
        console.log(formatOutput(success('source list-library', rows), format));
      } catch (err) {
        console.log(formatOutput(structuredFailure('source list-library', err instanceof Error ? err : String(err)), format));
        process.exit(1);
      }
    });

  source
    .command('list-templates')
    .description('List all API source templates')
    .option('--category <category>', 'Filter by category')
    .action((opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const templates = filterTemplates({
          category: opts.category,
        });
        const rows = templates.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category,
          authType: t.authType,
          proxyRequired: t.proxyRequired,
        }));
        console.log(formatOutput(success('source list-templates', rows), format));
      } catch (err) {
        console.log(formatOutput(structuredFailure('source list-templates', err instanceof Error ? err : String(err)), format));
        process.exit(1);
      }
    });
}
