import { describe, it, expect } from 'vitest';
import { PALETTES, PALETTE_NAMES, type PaletteColors } from '../palettes.js';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

describe('palettes', () => {
  it('exports 7 palettes', () => {
    expect(PALETTE_NAMES).toHaveLength(7);
  });

  it('PALETTE_NAMES matches PALETTES keys', () => {
    expect(PALETTE_NAMES).toEqual(Object.keys(PALETTES));
  });

  it('includes expected palette names', () => {
    const expected = ['default', 'ocean', 'forest', 'sunset', 'midnight', 'cyberpunk', 'minimal'];
    for (const name of expected) {
      expect(PALETTES[name]).toBeDefined();
    }
  });

  describe.each(PALETTE_NAMES)('palette: %s', (name) => {
    const palette = PALETTES[name];

    it('has name and label', () => {
      expect(palette.name).toBe(name);
      expect(palette.label.length).toBeGreaterThan(0);
    });

    it('has dark and light color sets', () => {
      expect(palette.dark).toBeDefined();
      expect(palette.light).toBeDefined();
    });

    const colorKeys: (keyof PaletteColors)[] = [
      'fg', 'bg', 'bgSecondary', 'bgPanel', 'border',
      'accent', 'accentHover', 'success', 'danger', 'warning', 'textMuted',
    ];

    for (const mode of ['dark', 'light'] as const) {
      it(`${mode} colors are all valid hex`, () => {
        for (const key of colorKeys) {
          expect(palette[mode][key], `${mode}.${key}`).toMatch(HEX_RE);
        }
      });
    }
  });

  it('default palette dark colors match base.css values', () => {
    const dark = PALETTES.default.dark;
    expect(dark.fg).toBe('#e0e0e0');
    expect(dark.bg).toBe('#0a0a0f');
    expect(dark.bgSecondary).toBe('#12121a');
    expect(dark.bgPanel).toBe('#1a1a2e');
    expect(dark.border).toBe('#2a2a3e');
    expect(dark.accent).toBe('#0052CC');
  });
});
