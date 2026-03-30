#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init.js';
import { registerSourceCommands } from '../src/commands/source/index.js';
import { registerLayerCommands } from '../src/commands/layer/index.js';
import { registerPanelCommands } from '../src/commands/panel/index.js';
import { registerAICommands } from '../src/commands/ai/index.js';
import { registerValidateCommand } from '../src/commands/validate.js';
import { registerBuildCommand } from '../src/commands/build.js';
import { registerDevCommand } from '../src/commands/dev.js';
import { registerDeployCommand } from '../src/commands/deploy.js';
import { registerEnvCommands } from '../src/commands/env.js';
import { registerPresetCommands } from '../src/commands/preset.js';
import { registerSetupCommand } from '../src/commands/setup.js';
import { registerViewCommands } from '../src/commands/view/index.js';
import { registerStatusCommand } from '../src/commands/status.js';
import { registerThemeCommands } from '../src/commands/theme.js';
import { registerConfigCommands } from '../src/commands/config.js';
import { registerSchemaCommand } from '../src/commands/schema.js';
// EXPERIMENTAL: gh CLI bridge PoC — validates the cli-bridge pattern for v0.6.0
import { registerGhBridgeCommand } from '../src/commands/gh-bridge.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

// Auto-TTY detection: format based on stdout, interactivity based on stdin
const isNonTTYOutput = !process.stdout.isTTY;
const isNonTTYInput = !process.stdin.isTTY;
const envFormat = process.env.FORGE_FORMAT;

function resolveDefaultFormat(): string {
  // Explicit env var takes precedence over auto-detection
  if (envFormat === 'json' || envFormat === 'human') {
    return envFormat === 'human' ? 'table' : 'json';
  }
  // Auto-detect: non-TTY defaults to JSON
  return isNonTTYOutput ? 'json' : 'table';
}

const program = new Command();

program
  .name('forge')
  .description('monitor-forge CLI - Create your own real-time intelligence dashboard')
  .version(pkg.version)
  .option('--format <format>', 'Output format: json, table, minimal', resolveDefaultFormat())
  .option('--non-interactive', 'Disable interactive prompts', isNonTTYInput)
  .option('--dry-run', 'Show what would change without modifying anything');

registerInitCommand(program);
registerSourceCommands(program);
registerLayerCommands(program);
registerPanelCommands(program);
registerAICommands(program);
registerValidateCommand(program);
registerBuildCommand(program);
registerDevCommand(program);
registerDeployCommand(program);
registerEnvCommands(program);
registerPresetCommands(program);
registerSetupCommand(program);
registerViewCommands(program);
registerStatusCommand(program);
registerThemeCommands(program);
registerConfigCommands(program);
registerSchemaCommand(program);
// EXPERIMENTAL: gh CLI bridge PoC — not part of stable API
registerGhBridgeCommand(program);

program.parse();
