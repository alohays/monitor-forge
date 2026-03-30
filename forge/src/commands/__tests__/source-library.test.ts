import { describe, it, expect } from 'vitest';
import { SourceSchema } from '../../config/schema.js';
import {
  loadRssLibrary,
  loadApiTemplates,
  libraryEntryToSourceConfig,
  templateToSourceConfig,
  findLibraryEntry,
  findApiTemplate,
  filterLibrary,
  filterTemplates,
} from '../source/library.js';

describe('Source Library', () => {
  it('loadRssLibrary() returns 244+ entries', () => {
    const entries = loadRssLibrary();
    expect(entries.length).toBeGreaterThanOrEqual(244);
  });

  it('loadApiTemplates() returns 20+ templates', () => {
    const templates = loadApiTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(20);
  });

  it('libraryEntryToSourceConfig() produces valid SourceSchema-compatible object', () => {
    const entry = findLibraryEntry('ap-news-top');
    expect(entry).toBeDefined();

    const config = libraryEntryToSourceConfig(entry!);
    const result = SourceSchema.safeParse(config);
    expect(result.success).toBe(true);
    expect(config.name).toBe('ap-news-top');
    expect(config.type).toBe('rss');
    expect(config.url).toBe(entry!.url);
    expect(config.category).toBe(entry!.category);
    expect(config.interval).toBe(300);
  });

  it('templateToSourceConfig() produces valid SourceSchema-compatible object', () => {
    const template = findApiTemplate('usgs-earthquakes');
    expect(template).toBeDefined();

    const config = templateToSourceConfig(template!);
    const result = SourceSchema.safeParse(config);
    expect(result.success).toBe(true);
    expect(config.name).toBe('usgs-earthquakes');
    expect(config.type).toBe('rest-api');
    expect(config.url).toBe('https://earthquake.usgs.gov/fdsnws/event/1/query');
    expect(config.category).toBe('geospatial');
  });

  it('findLibraryEntry() returns the correct entry by ID', () => {
    const entry = findLibraryEntry('reuters-world');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('reuters-world');
    expect(entry!.name).toBe('Reuters - World News');
    expect(entry!.category).toBe('politics');
  });

  it('filterLibrary({ category: "tech" }) returns only tech feeds', () => {
    const entries = filterLibrary({ category: 'tech' });
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.category).toBe('tech');
    }
  });

  it('filterLibrary({ verified: true }) filters by verified status', () => {
    const verifiedEntries = filterLibrary({ verified: true });
    for (const entry of verifiedEntries) {
      expect(entry.verified).toBe(true);
    }

    const unverifiedEntries = filterLibrary({ verified: false });
    for (const entry of unverifiedEntries) {
      expect(entry.verified).toBe(false);
    }

    // Together they should account for all entries
    const all = loadRssLibrary();
    expect(verifiedEntries.length + unverifiedEntries.length).toBe(all.length);
  });

  it('findApiTemplate() returns the correct template by ID', () => {
    const template = findApiTemplate('usgs-earthquakes');
    expect(template).toBeDefined();
    expect(template!.id).toBe('usgs-earthquakes');
    expect(template!.name).toBe('USGS Earthquakes');
    expect(template!.authType).toBe('none');
    expect(template!.category).toBe('geospatial');
  });

  it('filterTemplates({ category: "geospatial" }) returns only geospatial templates', () => {
    const templates = filterTemplates({ category: 'geospatial' });
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      expect(template.category).toBe('geospatial');
    }
  });

  it('templateToSourceConfig() includes authEnvVar when present', () => {
    // Find a template that has auth
    const templates = loadApiTemplates();
    const authTemplate = templates.find(t => t.authEnvVar);
    expect(authTemplate).toBeDefined();

    const config = templateToSourceConfig(authTemplate!);
    expect(config.authEnvVar).toBe(authTemplate!.authEnvVar);
  });

  it('findLibraryEntry() returns undefined for unknown ID', () => {
    const entry = findLibraryEntry('nonexistent-feed-id');
    expect(entry).toBeUndefined();
  });

  it('findApiTemplate() returns undefined for unknown ID', () => {
    const template = findApiTemplate('nonexistent-template-id');
    expect(template).toBeUndefined();
  });
});
