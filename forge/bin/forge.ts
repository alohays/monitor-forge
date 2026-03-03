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

const program = new Command();

program
  .name('forge')
  .description('monitor-forge CLI - Create your own real-time intelligence dashboard')
  .version('0.1.0')
  .option('--format <format>', 'Output format: json, table, minimal', 'table')
  .option('--non-interactive', 'Disable interactive prompts')
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

program.parse();
