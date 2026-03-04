import type { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { formatOutput, success, failure, type OutputFormat, type Change } from '../output/format.js';
import { generateManifests, generateProxyAllowlist } from '../generators/manifest-generator.js';
import { generateVercelConfig } from '../generators/vercel-generator.js';
import { generateEnvExample } from '../generators/env-generator.js';

export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build the dashboard for production')
    .option('--mode <mode>', 'Build mode: production or development', 'production')
    .option('--skip-vite', 'Only generate manifests, skip Vite build')
    .action(async (opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const config = loadConfig();
        const changes: Change[] = [];

        // 1. Generate manifests
        const generatedDir = resolve(process.cwd(), 'src/generated');
        if (!existsSync(generatedDir)) mkdirSync(generatedDir, { recursive: true });

        const manifests = generateManifests(config);

        if (!dryRun) {
          for (const [filename, content] of Object.entries(manifests)) {
            const filePath = resolve(generatedDir, filename);
            writeFileSync(filePath, content, 'utf-8');
            changes.push({ type: 'created', file: `src/generated/${filename}`, description: `Generated ${filename}` });
          }
        }

        // 2. Generate proxy allowlist for edge functions
        if (!dryRun) {
          const allowlistContent = generateProxyAllowlist(config);
          const allowlistPath = resolve(process.cwd(), 'api/_shared/proxy-allowlist.ts');
          writeFileSync(allowlistPath, allowlistContent, 'utf-8');
          changes.push({ type: 'created', file: 'api/_shared/proxy-allowlist.ts', description: 'Generated proxy domain allowlist' });
        }

        // 3. Generate vercel.json
        const vercelConfig = generateVercelConfig(config);
        if (!dryRun) {
          writeFileSync(resolve(process.cwd(), 'vercel.json'), JSON.stringify(vercelConfig, null, 2), 'utf-8');
          changes.push({ type: 'created', file: 'vercel.json', description: 'Generated Vercel config' });
        }

        // 4. Generate .env.example
        const envContent = generateEnvExample(config);
        if (!dryRun) {
          writeFileSync(resolve(process.cwd(), '.env.example'), envContent, 'utf-8');
          changes.push({ type: 'created', file: '.env.example', description: 'Generated env template' });
        }

        // 5. Run Vite build
        if (!opts.skipVite && !dryRun) {
          const { execSync } = await import('node:child_process');
          console.log('Running Vite build...');
          execSync(`npx vite build --mode ${opts.mode}`, {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          changes.push({ type: 'created', file: config.build.outDir, description: 'Vite production build' });
        }

        console.log(formatOutput(
          success('build', {
            mode: opts.mode,
            sources: config.sources.length,
            layers: config.layers.length,
            panels: config.panels.length,
            outDir: config.build.outDir,
            manifests: Object.keys(manifests).length,
          }, {
            changes,
            next_steps: dryRun ? [] : ['forge deploy --prod'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('build', String(err)), format));
        process.exit(1);
      }
    });
}
