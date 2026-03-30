import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiTemplatesSchema } from '../api-templates.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(resolve(__dirname, '../api-templates.json'), 'utf-8'),
);

describe('api-templates.json', () => {
  it('validates against ApiTemplatesSchema', () => {
    const result = ApiTemplatesSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Schema validation failed:\n${result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it('contains at least 20 templates', () => {
    expect(raw.templates.length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate IDs', () => {
    const ids = raw.templates.map((t: { id: string }) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all baseUrls are valid HTTPS (with known HTTP exceptions)', () => {
    const httpAllowed = new Set(['iss-location']);
    for (const t of raw.templates) {
      const url = new URL(t.baseUrl);
      if (httpAllowed.has(t.id)) {
        expect(url.protocol).toBe('http:');
      } else {
        expect(url.protocol).toBe('https:');
      }
    }
  });

  it('authEnvVar follows UPPER_SNAKE_CASE when present', () => {
    for (const t of raw.templates) {
      if (t.authEnvVar) {
        expect(t.authEnvVar).toMatch(/^[A-Z_][A-Z0-9_]*$/);
      }
    }
  });

  it('covers all required categories', () => {
    const categories = new Set(raw.templates.map((t: { category: string }) => t.category));
    const required = ['geospatial', 'financial', 'intelligence', 'science', 'social', 'infrastructure'];
    for (const cat of required) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('proxy-required templates have authEnvVar specified', () => {
    for (const t of raw.templates) {
      if (t.proxyRequired) {
        expect(t.authEnvVar).toBeDefined();
        expect(typeof t.authEnvVar).toBe('string');
        expect(t.authEnvVar.length).toBeGreaterThan(0);
      }
    }
  });

  it('all templates have at least 1 endpoint', () => {
    for (const t of raw.templates) {
      expect(t.endpoints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('snapshot stability', () => {
    const summary = raw.templates.map((t: { id: string; category: string; authType: string; proxyRequired: boolean }) => ({
      id: t.id,
      category: t.category,
      authType: t.authType,
      proxyRequired: t.proxyRequired,
    }));
    expect(summary).toMatchSnapshot();
  });
});
