import type { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy to Vercel')
    .option('--prod', 'Deploy to production')
    .option('--token <token>', 'Vercel authentication token')
    .option('--project <name>', 'Vercel project name')
    .action(async (opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const config = loadConfig();

        if (dryRun) {
          console.log(formatOutput(
            success('deploy --dry-run', {
              target: config.build.target,
              prod: opts.prod ?? false,
              project: opts.project ?? config.monitor.slug,
            }),
            format,
          ));
          return;
        }

        // Run build first
        const { execSync } = await import('node:child_process');

        console.log('Building...');
        execSync('npx forge build', { cwd: process.cwd(), stdio: 'inherit' });

        // Deploy
        const prodFlag = opts.prod ? '--prod' : '';
        const tokenFlag = opts.token ? `--token ${opts.token}` : '';
        const projectFlag = opts.project ? `--name ${opts.project}` : '';

        console.log('Deploying to Vercel...');
        const result = execSync(
          `npx vercel deploy ${prodFlag} ${tokenFlag} ${projectFlag} --yes`.trim(),
          { cwd: process.cwd(), encoding: 'utf-8' },
        );

        const url = result.trim().split('\n').pop() ?? '';

        console.log(formatOutput(
          success('deploy', {
            url,
            prod: opts.prod ?? false,
            project: opts.project ?? config.monitor.slug,
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('deploy', String(err)), format));
        process.exit(1);
      }
    });
}
