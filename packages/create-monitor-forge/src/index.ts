#!/usr/bin/env node
import { Command } from 'commander';
import { scaffold } from './scaffold.js';
import { runInteractive } from './prompts.js';
import { getPresetNames } from './presets.js';
import pc from 'picocolors';
import * as p from '@clack/prompts';

export const VERSION = '0.5.0';

const program = new Command()
  .name('create-monitor-forge')
  .description('Create a new monitor-forge dashboard project')
  .version(VERSION)
  .argument('[directory]', 'Project directory name')
  .option('--template <name>', 'Preset template to use', 'tech-minimal')
  .option('--no-ai', 'Disable AI features')
  .option('--no-install', 'Skip npm install')
  .option('-y, --yes', 'Skip interactive prompts')
  .action(async (directory: string | undefined, opts: { template: string; ai: boolean; install: boolean; yes: boolean }) => {
    try {
      let options: { directory: string; projectName: string; template: string; ai: boolean; install: boolean };

      if (opts.yes && directory) {
        // Non-interactive mode: validate template
        const validPresets = getPresetNames();
        if (!validPresets.includes(opts.template)) {
          console.error(
            pc.red(`Invalid template "${opts.template}". Available: ${validPresets.join(', ')}`)
          );
          process.exit(1);
        }

        options = {
          directory,
          projectName: directory,
          template: opts.template,
          ai: opts.ai,
          install: opts.install,
        };
      } else {
        // Interactive mode
        options = await runInteractive({
          directory,
          template: opts.template,
          ai: opts.ai,
          install: opts.install,
        });
      }

      const s = p.spinner();
      s.start('Creating project...');

      await scaffold(options);

      s.stop('Project created!');

      p.outro(pc.green('Done!'));

      console.log();
      console.log(pc.bold('Next steps:'));
      console.log();
      console.log(pc.cyan(`  cd ${options.directory}`));
      if (!options.install) {
        console.log(pc.cyan('  npm install'));
      }
      console.log(pc.cyan('  npm run validate'));
      console.log(pc.cyan('  npm run dev'));
      console.log();
    } catch (err) {
      p.cancel(pc.red(err instanceof Error ? err.message : 'An unexpected error occurred'));
      process.exit(1);
    }
  });

program.parse();
