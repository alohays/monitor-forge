import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { getPreset } from './presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ScaffoldOptions {
  directory: string;
  projectName: string;
  template: string;
  ai: boolean;
  install: boolean;
}

function resolveTemplateDir(): string {
  // In development (tsx), templates are next to source files
  const devPath = join(__dirname, 'templates');
  if (existsSync(devPath)) {
    return devPath;
  }
  // In published package, templates are at package root
  const distPath = join(__dirname, '..', 'templates');
  if (existsSync(distPath)) {
    return distPath;
  }
  throw new Error('Could not find templates directory');
}

function readTemplate(templateDir: string, filename: string): string {
  const filePath = join(templateDir, filename);
  return readFileSync(filePath, 'utf-8');
}

function applyReplacements(content: string, replacements: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function generateConfig(template: string, projectName: string, ai: boolean): string {
  const preset = getPreset(template);
  const slug = projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  // Base config structure matching monitor-forge.config.json schema
  const config: Record<string, unknown> = {
    version: '1',
    monitor: {
      name: projectName,
      slug,
      description: preset?.description ?? `A ${template} intelligence dashboard`,
      domain: preset?.domain ?? 'general',
      tags: [],
    },
    sources: [],
    layers: [],
    panels: [],
    views: [],
    ai: {
      enabled: ai,
      ...(ai
        ? {
            fallbackChain: ['groq'],
            providers: {
              groq: {
                model: 'llama-3.3-70b-versatile',
                apiKeyEnv: 'GROQ_API_KEY',
              },
            },
            analysis: {
              summarization: true,
              entityExtraction: true,
              sentimentAnalysis: false,
            },
          }
        : {}),
    },
    map: {
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [0, 20],
      zoom: 3,
      projection: 'mercator',
    },
    theme: {
      mode: 'dark',
      palette: 'default',
    },
  };

  return JSON.stringify(config, null, 2) + '\n';
}

export async function scaffold(options: ScaffoldOptions): Promise<string> {
  const { directory, projectName, template, ai, install } = options;
  const targetDir = resolve(directory);

  if (existsSync(targetDir)) {
    throw new Error(`Directory "${directory}" already exists. Please choose a different name.`);
  }

  // Create target directory
  mkdirSync(targetDir, { recursive: true });

  const templateDir = resolveTemplateDir();
  const replacements: Record<string, string> = {
    PROJECT_NAME: projectName,
  };

  // Copy template files
  const templateFiles: Array<{ src: string; dest: string }> = [
    { src: 'package.json.tmpl', dest: 'package.json' },
    { src: 'tsconfig.json.tmpl', dest: 'tsconfig.json' },
    { src: 'vite.config.ts.tmpl', dest: 'vite.config.ts' },
    { src: 'vercel.json.tmpl', dest: 'vercel.json' },
    { src: 'gitignore.tmpl', dest: '.gitignore' },
    { src: 'env.example.tmpl', dest: '.env.example' },
    { src: 'README.md.tmpl', dest: 'README.md' },
  ];

  for (const { src, dest } of templateFiles) {
    const content = readTemplate(templateDir, src);
    const processed = applyReplacements(content, replacements);
    writeFileSync(join(targetDir, dest), processed, 'utf-8');
  }

  // Generate monitor-forge.config.json from template/preset
  const configContent = generateConfig(template, projectName, ai);
  writeFileSync(join(targetDir, 'monitor-forge.config.json'), configContent, 'utf-8');

  // Run npm install if requested
  if (install) {
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
  }

  return targetDir;
}
