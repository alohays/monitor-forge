#!/usr/bin/env npx tsx
/**
 * Demo GIF Frame Capture Script
 *
 * Captures frames for a demo GIF in two phases:
 *   - Frames 1-90:   Terminal animation scenes from terminal.html
 *   - Frames 91-150: Live dashboard screenshots from forge dev server
 *
 * Usage: npx tsx scripts/demo/capture.ts
 */

import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { resolve as resolvePath, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolvePath(fileURLToPath(import.meta.url), '..');
const FRAMES_DIR = resolvePath(__dirname, 'frames');
const TERMINAL_HTML = resolvePath(__dirname, 'terminal.html');
const DASHBOARD_HTML = resolvePath(__dirname, 'dashboard.html');

function frameFilename(n: number): string {
  return join(FRAMES_DIR, `frame-${String(n).padStart(4, '0')}.png`);
}

async function main(): Promise<void> {
  // --- Setup: clean and recreate frames directory ---
  console.log('Setting up frames directory...');
  await rm(FRAMES_DIR, { recursive: true, force: true });
  await mkdir(FRAMES_DIR, { recursive: true });

  const browser = await chromium.launch();

  try {
    // ----------------------------------------------------------------
    // Phase 1: Terminal frames (1–90)
    // ----------------------------------------------------------------
    console.log('Opening terminal.html...');
    const terminalPage = await browser.newPage();
    await terminalPage.setViewportSize({ width: 1600, height: 1000 });
    await terminalPage.goto(`file://${TERMINAL_HTML}`);

    for (let scene = 1; scene <= 3; scene++) {
      console.log(`Capturing terminal scene ${scene}...`);
      await terminalPage.evaluate(`setScene(${scene})`);

      const startFrame = (scene - 1) * 30 + 1; // 1, 31, 61
      for (let i = 0; i < 30; i++) {
        const frameNum = startFrame + i;
        await terminalPage.screenshot({ path: frameFilename(frameNum) });
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    await terminalPage.close();

    // ----------------------------------------------------------------
    // Phase 2: Dashboard frames (91–150) from static mockup
    // ----------------------------------------------------------------
    console.log('Opening dashboard.html mockup...');
    const dashPage = await browser.newPage();
    await dashPage.setViewportSize({ width: 1600, height: 1000 });
    await dashPage.goto(`file://${DASHBOARD_HTML}`);

    // Scene 1: news items fade in (frames 91-120)
    console.log('Capturing dashboard scene 1 (fade in)...');
    await dashPage.evaluate('setScene(1)');
    for (let i = 0; i < 30; i++) {
      const frameNum = 91 + i;
      await dashPage.screenshot({ path: frameFilename(frameNum) });
      await new Promise((r) => setTimeout(r, 100));
    }

    // Scene 2: all visible, animations running (frames 121-150)
    console.log('Capturing dashboard scene 2 (full dashboard)...');
    await dashPage.evaluate('setScene(2)');
    for (let i = 0; i < 30; i++) {
      const frameNum = 121 + i;
      await dashPage.screenshot({ path: frameFilename(frameNum) });
      await new Promise((r) => setTimeout(r, 100));
    }

    await dashPage.close();
  } finally {
    await browser.close();
  }

  console.log(`Done. ${150} frames saved to ${FRAMES_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
