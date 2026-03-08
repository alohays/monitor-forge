import { PALETTES, type PaletteColors } from './palettes.js';
import type { MonitorForgeConfig } from '../config/schema.js';

export interface ResolvedTheme {
  mode: 'dark' | 'light' | 'auto';
  dark: PaletteColors;
  light: PaletteColors;
  panelPosition: 'right' | 'left';
  panelWidth: number;
  compactMode: boolean;
}

export function resolveTheme(config: MonitorForgeConfig): ResolvedTheme {
  const theme = config.theme;
  const palette = PALETTES[theme.palette] ?? PALETTES.default;

  // Start with palette colors
  const dark = { ...palette.dark };
  const light = { ...palette.light };

  // Overlay custom accent: explicit theme.colors.accent wins,
  // then branding.primaryColor only if palette is 'default' (avoids overriding palette accents)
  const customAccent = theme.colors.accent ?? (
    theme.palette === 'default' && config.monitor.branding.primaryColor !== '#0052CC'
      ? config.monitor.branding.primaryColor
      : undefined
  );

  if (customAccent) {
    dark.accent = customAccent;
    light.accent = customAccent;
  }

  if (theme.colors.accentHover) {
    dark.accentHover = theme.colors.accentHover;
    light.accentHover = theme.colors.accentHover;
  }

  return {
    mode: theme.mode,
    dark,
    light,
    panelPosition: theme.panelPosition,
    panelWidth: theme.panelWidth,
    compactMode: theme.compactMode,
  };
}
