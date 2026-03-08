import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../resolver.js';
import { PALETTES } from '../palettes.js';
import { createDefaultConfig } from '../../config/defaults.js';
import { MonitorForgeConfigSchema } from '../../config/schema.js';

function buildConfig(overrides?: Record<string, unknown>) {
  return MonitorForgeConfigSchema.parse(createDefaultConfig(overrides as never));
}

describe('resolveTheme', () => {
  it('resolves default config to default palette dark colors', () => {
    const config = buildConfig();
    const resolved = resolveTheme(config);

    expect(resolved.mode).toBe('dark');
    expect(resolved.dark).toEqual(PALETTES.default.dark);
    expect(resolved.light).toEqual(PALETTES.default.light);
    expect(resolved.panelPosition).toBe('right');
    expect(resolved.panelWidth).toBe(380);
    expect(resolved.compactMode).toBe(false);
  });

  it('resolves ocean palette correctly', () => {
    const config = buildConfig({ theme: { palette: 'ocean' } });
    const resolved = resolveTheme(config);

    expect(resolved.dark.accent).toBe(PALETTES.ocean.dark.accent);
    expect(resolved.light.accent).toBe(PALETTES.ocean.light.accent);
  });

  it('custom accent overrides palette accent', () => {
    const config = buildConfig({ theme: { palette: 'ocean', colors: { accent: '#FF0000' } } });
    const resolved = resolveTheme(config);

    expect(resolved.dark.accent).toBe('#FF0000');
    expect(resolved.light.accent).toBe('#FF0000');
  });

  it('falls back to branding.primaryColor when no custom accent', () => {
    const config = buildConfig({
      monitor: { name: 'Test', slug: 'test', domain: 'test', branding: { primaryColor: '#123456' } },
    });
    const resolved = resolveTheme(config);

    expect(resolved.dark.accent).toBe('#123456');
    expect(resolved.light.accent).toBe('#123456');
  });

  it('does not use branding fallback when primaryColor is default #0052CC', () => {
    const config = buildConfig();
    const resolved = resolveTheme(config);

    // Should use palette accent, not branding fallback
    expect(resolved.dark.accent).toBe(PALETTES.default.dark.accent);
  });

  it('always emits both dark and light color sets', () => {
    const config = buildConfig({ theme: { mode: 'light' } });
    const resolved = resolveTheme(config);

    expect(resolved.mode).toBe('light');
    expect(resolved.dark).toBeDefined();
    expect(resolved.light).toBeDefined();
  });

  it('preserves panelPosition and panelWidth', () => {
    const config = buildConfig({ theme: { panelPosition: 'left', panelWidth: 500 } });
    const resolved = resolveTheme(config);

    expect(resolved.panelPosition).toBe('left');
    expect(resolved.panelWidth).toBe(500);
  });

  it('falls back to default palette for unknown palette name', () => {
    // Schema enforces valid names, but resolver handles gracefully
    const config = buildConfig();
    config.theme.palette = 'nonexistent' as never;
    const resolved = resolveTheme(config);

    expect(resolved.dark).toEqual(PALETTES.default.dark);
  });

  it('non-default palette accent is NOT overridden by branding.primaryColor', () => {
    const config = buildConfig({
      monitor: { name: 'Test', slug: 'test', domain: 'test', branding: { primaryColor: '#00FF41' } },
      theme: { palette: 'cyberpunk' },
    });
    const resolved = resolveTheme(config);

    // Palette accent should win when a non-default palette is chosen
    expect(resolved.dark.accent).toBe(PALETTES.cyberpunk.dark.accent);
    expect(resolved.light.accent).toBe(PALETTES.cyberpunk.light.accent);
  });

  it('branding.primaryColor only applies when palette is default', () => {
    const config = buildConfig({
      monitor: { name: 'Test', slug: 'test', domain: 'test', branding: { primaryColor: '#123456' } },
      theme: { palette: 'default' },
    });
    const resolved = resolveTheme(config);

    expect(resolved.dark.accent).toBe('#123456');
  });
});
