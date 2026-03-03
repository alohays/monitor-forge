import type { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { generateManifests } from '../generators/manifest-generator.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Start development server')
    .option('--port <port>', 'Dev server port', '5173')
    .option('--host', 'Expose to network')
    .action(async (opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;

      try {
        const config = loadConfig();

        // Generate manifests before starting dev server
        const generatedDir = resolve(process.cwd(), 'src/generated');
        if (!existsSync(generatedDir)) mkdirSync(generatedDir, { recursive: true });

        const manifests = generateManifests(config);
        for (const [filename, content] of Object.entries(manifests)) {
          writeFileSync(resolve(generatedDir, filename), content, 'utf-8');
        }

        console.log(formatOutput(
          success('dev', {
            port: opts.port,
            sources: config.sources.length,
            layers: config.layers.length,
            panels: config.panels.length,
          }),
          format,
        ));

        // Start Vite dev server
        const { execSync } = await import('node:child_process');
        const hostFlag = opts.host ? '--host' : '';
        execSync(`npx vite --port ${opts.port} ${hostFlag}`, {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      } catch (err) {
        console.log(formatOutput(failure('dev', String(err)), format));
        process.exit(1);
      }
    });
}
