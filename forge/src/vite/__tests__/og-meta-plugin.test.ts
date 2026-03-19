import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plugin } from 'vite';
import type { MonitorForgeConfig } from '../../config/schema.js';

// Mock loadConfig before importing the plugin
vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

import { ogMetaPlugin } from '../og-meta-plugin.js';
import { loadConfig } from '../../config/loader.js';

const mockLoadConfig = vi.mocked(loadConfig);

const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Monitor Forge</title>
  <meta property="og:title" content="Monitor Forge">
  <meta property="og:description" content="Real-time intelligence dashboard built with monitor-forge">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Monitor Forge">
  <meta name="twitter:description" content="Real-time intelligence dashboard built with monitor-forge">
</head>
<body><div id="app"></div></body>
</html>`;

function makeConfig(brandingOverrides: Partial<MonitorForgeConfig['monitor']['branding']> = {}): MonitorForgeConfig {
  return {
    version: '1',
    monitor: {
      name: 'My Dashboard',
      slug: 'my-dashboard',
      description: 'A custom dashboard',
      domain: 'example.com',
      tags: [],
      branding: {
        primaryColor: '#0052CC',
        ...brandingOverrides,
      },
    },
    sources: [],
    layers: [],
    panels: [],
    views: [],
    ai: {
      enabled: true,
      fallbackChain: ['groq', 'openrouter'],
      providers: {},
      analysis: {
        summarization: true,
        entityExtraction: true,
        sentimentAnalysis: true,
        focalPointDetection: false,
      },
    },
    map: {
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [0, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      projection: 'mercator',
      dayNightOverlay: false,
      atmosphericGlow: true,
      idleRotation: true,
      idleRotationSpeed: 0.5,
    },
    backend: {
      cache: { provider: 'memory', ttlSeconds: 300 },
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] },
    },
    build: { target: 'vercel', outDir: 'dist' },
    theme: {
      mode: 'dark',
      palette: 'default',
      colors: {},
      panelPosition: 'right',
      panelWidth: 380,
      compactMode: false,
    },
  };
}

function getPlugin(): Plugin {
  return ogMetaPlugin();
}

function transformHtml(plugin: Plugin, html: string): string {
  const transform = plugin.transformIndexHtml as (html: string) => string;
  return transform(html);
}

describe('ogMetaPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces og:title with config name', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain('<meta property="og:title" content="My Dashboard">');
  });

  it('replaces og:description with config description', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      '<meta property="og:description" content="A custom dashboard">',
    );
  });

  it('replaces twitter:title with config name', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain('<meta name="twitter:title" content="My Dashboard">');
  });

  it('replaces twitter:description with config description', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      '<meta name="twitter:description" content="A custom dashboard">',
    );
  });

  it('replaces <title> with config name', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain('<title>My Dashboard</title>');
  });

  it('uses fallback description when config description is empty', () => {
    const cfg = makeConfig();
    cfg.monitor.description = '';
    mockLoadConfig.mockReturnValue(cfg);
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      'Real-time intelligence dashboard built with monitor-forge',
    );
  });

  it('injects og:image and twitter:image when ogImage is configured', () => {
    mockLoadConfig.mockReturnValue(makeConfig({ ogImage: 'https://example.com/og.png' }));
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      '<meta property="og:image" content="https://example.com/og.png">',
    );
    expect(result).toContain(
      '<meta name="twitter:image" content="https://example.com/og.png">',
    );
  });

  it('removes og:image when not configured and it exists in HTML', () => {
    const htmlWithOgImage = BASE_HTML.replace(
      '</head>',
      '  <meta property="og:image" content="https://old.example.com/og.png">\n</head>',
    );
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), htmlWithOgImage);
    expect(result).not.toContain('og:image');
    expect(result).not.toContain('twitter:image');
  });

  it('does not add og:image when ogImage is not configured', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).not.toContain('og:image');
  });

  it('returns HTML unchanged when config cannot be loaded', () => {
    mockLoadConfig.mockImplementation(() => {
      throw new Error('Config file not found');
    });
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toBe(BASE_HTML);
  });

  it('escapes HTML special characters in name', () => {
    const cfg = makeConfig();
    cfg.monitor.name = 'A&B <Dashboard> "Forge"';
    mockLoadConfig.mockReturnValue(cfg);
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      'content="A&amp;B &lt;Dashboard&gt; &quot;Forge&quot;"',
    );
  });

  it('escapes HTML special characters in description', () => {
    const cfg = makeConfig();
    cfg.monitor.description = 'Watch "live" data & more <today>';
    mockLoadConfig.mockReturnValue(cfg);
    const result = transformHtml(getPlugin(), BASE_HTML);
    expect(result).toContain(
      'content="Watch &quot;live&quot; data &amp; more &lt;today&gt;"',
    );
  });

  it('replaces existing og:image when ogImage is configured and og:image already present', () => {
    const htmlWithOgImage = BASE_HTML.replace(
      '</head>',
      '  <meta property="og:image" content="https://old.example.com/og.png">\n</head>',
    );
    mockLoadConfig.mockReturnValue(makeConfig({ ogImage: 'https://new.example.com/og.png' }));
    const result = transformHtml(getPlugin(), htmlWithOgImage);
    expect(result).toContain(
      '<meta property="og:image" content="https://new.example.com/og.png">',
    );
    expect(result).not.toContain('old.example.com');
  });
});
