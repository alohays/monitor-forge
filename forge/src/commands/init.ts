import type { Command } from 'commander';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { configExists, writeConfig } from '../config/loader.js';
import { createDefaultConfig } from '../config/defaults.js';
import type { MonitorForgeConfig } from '../config/schema.js';
import { formatOutput, success, failure, structuredFailure, type OutputFormat } from '../output/format.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new monitor-forge dashboard')
    .option('--name <name>', 'Monitor name')
    .option('--domain <domain>', 'Primary domain (technology, finance, geopolitics, climate, etc.)')
    .option('--template <preset>', 'Starting preset (tech-minimal, finance-minimal, blank, etc.)')
    .option('--slug <slug>', 'URL-friendly slug')
    .option('--description <desc>', 'Short description')
    .option('--force', 'Overwrite existing config file')
    .action(async (opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const nonInteractive = program.opts().nonInteractive ?? false;
      const dryRun = program.opts().dryRun ?? false;

      if (configExists() && !dryRun && !opts.force) {
        console.log(formatOutput(
          structuredFailure('init', 'monitor-forge.config.json already exists. Use --force to overwrite.'),
          format,
        ));
        process.exit(1);
      }

      const name = opts.name ?? 'My Monitor';
      const domain = opts.domain ?? 'general';
      const slug = opts.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Load preset if specified
      let presetOverrides: Partial<MonitorForgeConfig> = {};
      if (opts.template && opts.template !== 'blank') {
        if (!/^[a-z0-9-]+$/.test(opts.template)) {
          console.log(formatOutput(
            structuredFailure('init', 'Preset name must be lowercase alphanumeric with hyphens'),
            format,
          ));
          process.exit(1);
        }
        const presetsDir = resolve(process.cwd(), 'presets');
        const presetPath = resolve(presetsDir, `${opts.template}.json`);
        if (!presetPath.startsWith(presetsDir)) {
          console.log(formatOutput(
            structuredFailure('init', 'Invalid preset name: path escapes presets directory'),
            format,
          ));
          process.exit(1);
        }
        if (existsSync(presetPath)) {
          const realPresetPath = realpathSync(presetPath);
          const realPresetsDir = realpathSync(presetsDir);
          if (!realPresetPath.startsWith(realPresetsDir + '/')) {
            console.log(formatOutput(
              structuredFailure('init', 'Invalid preset: resolved path escapes presets directory'),
              format,
            ));
            process.exit(1);
          }
          presetOverrides = JSON.parse(readFileSync(presetPath, 'utf-8'));
        } else {
          console.log(formatOutput(
            failure('init', `Preset "${opts.template}" not found at ${presetPath}`),
            format,
          ));
          process.exit(1);
        }
      }

      const config = createDefaultConfig({
        ...presetOverrides,
        monitor: {
          name,
          slug,
          description: opts.description ?? `Real-time intelligence dashboard for ${domain}`,
          domain,
          tags: presetOverrides.monitor?.tags ?? [],
          branding: presetOverrides.monitor?.branding ?? { primaryColor: '#0052CC' },
        },
      });

      if (dryRun) {
        console.log(formatOutput(
          success('init --dry-run', config, {
            changes: [
              { type: 'created', file: 'monitor-forge.config.json', description: 'Would create config file' },
              { type: 'created', file: '.env.example', description: 'Would generate env template' },
            ],
          }),
          format,
        ));
        return;
      }

      const configPath = writeConfig(config);

      // Generate .env.example
      const envVars = collectEnvVars(config);
      const envContent = envVars.map(v => `# ${v.description}\n${v.key}=`).join('\n\n') + '\n';
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(process.cwd(), '.env.example'), envContent, 'utf-8');

      console.log(formatOutput(
        success('init', {
          name: config.monitor.name,
          slug: config.monitor.slug,
          domain: config.monitor.domain,
          template: opts.template ?? 'blank',
          sources: config.sources.length,
          layers: config.layers.length,
          panels: config.panels.length,
        }, {
          changes: [
            { type: 'created', file: configPath, description: 'Created config file' },
            { type: 'created', file: '.env.example', description: 'Generated env template' },
          ],
          next_steps: [
            'Edit .env.example → .env.local and fill in API keys',
            'Run `npx forge source add rss --name "..." --url "..." --category "..."` to add feeds',
            'Run `npx forge dev` to start development server',
          ],
        }),
        format,
      ));
    });
}

interface EnvVar {
  key: string;
  description: string;
}

function collectEnvVars(config: MonitorForgeConfig): EnvVar[] {
  const vars: EnvVar[] = [];

  // AI providers
  for (const [name, provider] of Object.entries(config.ai.providers)) {
    vars.push({ key: provider.apiKeyEnv, description: `${name} API key` });
  }

  // Cache
  if (config.backend.cache.provider === 'upstash-redis') {
    vars.push({ key: 'UPSTASH_REDIS_REST_URL', description: 'Upstash Redis REST URL' });
    vars.push({ key: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash Redis REST token' });
  }

  // Sources with env references in headers
  for (const source of config.sources) {
    if (source.headers) {
      for (const value of Object.values(source.headers)) {
        const envMatch = value.match(/\$\{env\.([A-Z_]+)\}/);
        if (envMatch) {
          vars.push({ key: envMatch[1], description: `API key for source "${source.name}"` });
        }
      }
    }
  }

  return vars;
}
