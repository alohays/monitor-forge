import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RssLibrarySchema, type RssLibraryEntry } from '../../../data/rss-library.schema.js';
import { ApiTemplatesSchema, type ApiTemplate } from '../../../data/api-templates.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../data');

export function loadRssLibrary(): RssLibraryEntry[] {
  const raw = readFileSync(resolve(DATA_DIR, 'rss-library.json'), 'utf-8');
  const parsed = RssLibrarySchema.parse(JSON.parse(raw));
  return parsed.entries;
}

export function loadApiTemplates(): ApiTemplate[] {
  const raw = readFileSync(resolve(DATA_DIR, 'api-templates.json'), 'utf-8');
  const parsed = ApiTemplatesSchema.parse(JSON.parse(raw));
  return parsed.templates;
}

export function libraryEntryToSourceConfig(entry: RssLibraryEntry): Record<string, unknown> {
  return {
    name: entry.id,
    type: 'rss',
    url: entry.url,
    category: entry.category,
    tier: entry.tier,
    interval: 300,
    language: entry.language,
    tags: entry.tags,
  };
}

export function templateToSourceConfig(template: ApiTemplate): Record<string, unknown> {
  const firstEndpoint = template.endpoints[0];
  const config: Record<string, unknown> = {
    name: template.id,
    type: 'rest-api',
    url: template.baseUrl + firstEndpoint.path,
    category: template.category,
    tier: template.tier,
    interval: firstEndpoint.interval,
  };
  if (template.authEnvVar) {
    config.authEnvVar = template.authEnvVar;
  }
  return config;
}

export function findLibraryEntry(id: string): RssLibraryEntry | undefined {
  const entries = loadRssLibrary();
  return entries.find(e => e.id === id);
}

export function findApiTemplate(id: string): ApiTemplate | undefined {
  const templates = loadApiTemplates();
  return templates.find(t => t.id === id);
}

export function filterLibrary(options: {
  category?: string;
  language?: string;
  tier?: number;
  verified?: boolean;
}): RssLibraryEntry[] {
  let entries = loadRssLibrary();
  if (options.category !== undefined) {
    entries = entries.filter(e => e.category === options.category);
  }
  if (options.language !== undefined) {
    entries = entries.filter(e => e.language === options.language);
  }
  if (options.tier !== undefined) {
    entries = entries.filter(e => e.tier === options.tier);
  }
  if (options.verified !== undefined) {
    entries = entries.filter(e => e.verified === options.verified);
  }
  return entries;
}

export function filterTemplates(options: {
  category?: string;
}): ApiTemplate[] {
  let templates = loadApiTemplates();
  if (options.category !== undefined) {
    templates = templates.filter(t => t.category === options.category);
  }
  return templates;
}
