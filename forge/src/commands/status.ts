import type { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configExists, loadConfig } from '../config/loader.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';
import { collectRequiredEnvVars, parseEnvFile } from './env.js';

interface StatusData {
  configExists: boolean;
  configValid: boolean;
  configError?: string;
  sources: number;
  layers: number;
  panels: number;
  views: number;
  aiEnabled: boolean;
  envStatus: { key: string; set: boolean; required: boolean }[];
  suggestedActions: string[];
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show complete project state and suggested next actions')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;

      const status: StatusData = {
        configExists: false,
        configValid: false,
        sources: 0,
        layers: 0,
        panels: 0,
        views: 0,
        aiEnabled: false,
        envStatus: [],
        suggestedActions: [],
      };

      // Check config existence
      if (!configExists()) {
        status.suggestedActions.push('Run `forge init` or `forge setup` to create a config file');
        console.log(formatOutput(success('status', status), format));
        return;
      }

      status.configExists = true;

      // Try loading and validating config
      try {
        const config = loadConfig();
        status.configValid = true;
        status.sources = config.sources.length;
        status.layers = config.layers.length;
        status.panels = config.panels.length;
        status.views = config.views.length;
        status.aiEnabled = config.ai.enabled;

        // Check env vars
        const required = collectRequiredEnvVars(config);
        const envLocalPath = resolve(process.cwd(), '.env.local');
        let envLocal: Record<string, string> = {};
        if (existsSync(envLocalPath)) {
          envLocal = parseEnvFile(readFileSync(envLocalPath, 'utf-8'));
        }

        status.envStatus = required.map(v => ({
          key: v.key,
          set: !!(process.env[v.key] || envLocal[v.key]),
          required: v.required,
        }));

        // Compute suggested actions
        if (config.sources.length === 0) {
          status.suggestedActions.push('Run `forge source add rss --name "..." --url "..." --category "..."` to add a data source');
        }
        if (config.panels.length === 0) {
          status.suggestedActions.push('Run `forge panel add news-feed --name "..." --display-name "..."` to add a panel');
        }
        if (config.views.length === 0 && config.panels.length > 0) {
          status.suggestedActions.push('Run `forge view add <name> --display-name "..." --panels "..."` to organize panels into views');
        }

        const missingEnv = status.envStatus.filter(e => e.required && !e.set);
        if (missingEnv.length > 0) {
          status.suggestedActions.push(`Set missing env vars: ${missingEnv.map(e => e.key).join(', ')} (see .env.local)`);
        }

        // Check orphan panels (not in any view)
        if (config.views.length > 0) {
          const viewedPanels = new Set(config.views.flatMap(v => v.panels));
          const orphans = config.panels.filter(p => !viewedPanels.has(p.name));
          if (orphans.length > 0) {
            status.suggestedActions.push(`Add orphan panels to views: ${orphans.map(p => p.name).join(', ')}`);
          }
        }

        if (status.suggestedActions.length === 0) {
          status.suggestedActions.push('Run `forge validate` to check config');
          status.suggestedActions.push('Run `forge dev` to start development server');
        }
      } catch (err) {
        status.configValid = false;
        status.configError = String(err);
        status.suggestedActions.push('Fix config errors: run `forge validate` for details');
        status.suggestedActions.push('Or run `forge setup --force` to recreate config');
      }

      console.log(formatOutput(success('status', status), format));
    });
}
