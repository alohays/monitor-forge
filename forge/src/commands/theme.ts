import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../config/loader.js';
import { ThemeSchema } from '../config/schema.js';
import { PALETTES, PALETTE_NAMES } from '../theme/palettes.js';
import { resolveTheme } from '../theme/resolver.js';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

export function registerThemeCommands(program: Command): void {
  const theme = program.command('theme').description('Manage dashboard visual theme');

  theme
    .command('set')
    .description('Set theme options')
    .option('--mode <mode>', 'Theme mode: dark, light, auto')
    .option('--palette <name>', `Palette preset: ${PALETTE_NAMES.join(', ')}`)
    .option('--accent <color>', 'Custom accent color (#hex)')
    .option('--accent-hover <color>', 'Custom accent hover color (#hex)')
    .option('--panel-position <pos>', 'Panel position: right, left')
    .option('--panel-width <px>', 'Panel width in pixels (200-800)')
    .option('--compact', 'Enable compact mode')
    .option('--no-compact', 'Disable compact mode')
    .action((opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        const updates: Record<string, unknown> = {};

        if (opts.mode) updates.mode = opts.mode;
        if (opts.palette) updates.palette = opts.palette;
        if (opts.panelPosition) updates.panelPosition = opts.panelPosition;
        if (opts.panelWidth) updates.panelWidth = parseInt(opts.panelWidth, 10);
        if (opts.compact !== undefined) updates.compactMode = opts.compact;

        const colors: Record<string, string> = {};
        if (opts.accent) colors.accent = opts.accent;
        if (opts.accentHover) colors.accentHover = opts.accentHover;
        if (Object.keys(colors).length > 0) updates.colors = colors;

        if (Object.keys(updates).length === 0) {
          console.log(formatOutput(failure('theme set', 'No options provided. Use --mode, --palette, --accent, etc.'), format));
          process.exit(1);
        }

        // Validate the partial update
        ThemeSchema.partial().parse(updates);

        if (dryRun) {
          console.log(formatOutput(
            success('theme set --dry-run', updates, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: 'Would update theme settings' }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => ({
          ...cfg,
          theme: {
            ...cfg.theme,
            ...updates,
            colors: { ...cfg.theme.colors, ...((updates.colors as Record<string, string>) ?? {}) },
          },
        }));

        console.log(formatOutput(
          success('theme set', config.theme, {
            changes: [{ type: 'modified', file: path, description: 'Updated theme settings' }],
            next_steps: ['forge build', 'forge dev'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('theme set', String(err)), format));
        process.exit(1);
      }
    });

  theme
    .command('status')
    .description('Show current theme configuration and resolved values')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const resolved = resolveTheme(config);

        console.log(formatOutput(
          success('theme status', {
            mode: config.theme.mode,
            palette: config.theme.palette,
            customColors: config.theme.colors,
            panelPosition: config.theme.panelPosition,
            panelWidth: config.theme.panelWidth,
            compactMode: config.theme.compactMode,
            resolvedDarkAccent: resolved.dark.accent,
            resolvedLightAccent: resolved.light.accent,
            availablePalettes: PALETTE_NAMES,
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('theme status', String(err)), format));
        process.exit(1);
      }
    });
}
