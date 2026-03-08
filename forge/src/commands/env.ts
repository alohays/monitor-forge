import type { Command } from 'commander';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerEnvCommands(program: Command): void {
  const env = program.command('env').description('Manage environment variables');

  env
    .command('check')
    .description('Check which environment variables are set')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const required = collectRequiredEnvVars(config);

        // Try loading .env.local
        const envLocalPath = resolve(process.cwd(), '.env.local');
        let envLocal: Record<string, string> = {};
        if (existsSync(envLocalPath)) {
          const content = readFileSync(envLocalPath, 'utf-8');
          envLocal = parseEnvFile(content);
        }

        const status = required.map(v => ({
          key: v.key,
          description: v.description,
          required: v.required ? 'yes' : 'no',
          set: (!!process.env[v.key] || !!envLocal[v.key]) ? 'yes' : 'no',
        }));

        const missing = status.filter(s => s.required === 'yes' && s.set === 'no');

        console.log(formatOutput(
          success('env check', status, {
            warnings: missing.map(m => `Missing required: ${m.key} (${m.description})`),
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('env check', String(err)), format));
        process.exit(1);
      }
    });

  env
    .command('generate')
    .description('Generate .env.example from current config')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const config = loadConfig();
        const vars = collectRequiredEnvVars(config);
        const content = vars.map(v =>
          `# ${v.description}${v.required ? ' (required)' : ' (optional)'}\n${v.key}=`
        ).join('\n\n') + '\n';

        if (dryRun) {
          console.log(formatOutput(
            success('env generate --dry-run', { vars: vars.length, content }),
            format,
          ));
          return;
        }

        const envPath = resolve(process.cwd(), '.env.example');
        writeFileSync(envPath, content, 'utf-8');

        console.log(formatOutput(
          success('env generate', { vars: vars.length, path: envPath }, {
            changes: [{ type: 'created', file: envPath, description: `Generated with ${vars.length} variables` }],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('env generate', String(err)), format));
        process.exit(1);
      }
    });
}

export interface EnvVarInfo {
  key: string;
  description: string;
  required: boolean;
}

export function collectRequiredEnvVars(config: import('../config/schema.js').MonitorForgeConfig): EnvVarInfo[] {
  const vars: EnvVarInfo[] = [];

  // AI providers
  if (config.ai.enabled) {
    for (const [name, provider] of Object.entries(config.ai.providers)) {
      vars.push({
        key: provider.apiKeyEnv,
        description: `${name} API key for AI analysis`,
        required: config.ai.fallbackChain.includes(name),
      });
    }
  }

  // Cache
  if (config.backend.cache.provider === 'upstash-redis') {
    vars.push({ key: 'UPSTASH_REDIS_REST_URL', description: 'Upstash Redis REST URL', required: true });
    vars.push({ key: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash Redis REST token', required: true });
  }

  // Sources with env references
  for (const source of config.sources) {
    if (source.headers) {
      for (const value of Object.values(source.headers)) {
        const match = value.match(/\$\{env\.([A-Z_][A-Z0-9_]*)\}/);
        if (match) {
          vars.push({ key: match[1], description: `API key for source "${source.name}"`, required: true });
        }
      }
    }
  }

  return vars;
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = value;
  }
  return result;
}
