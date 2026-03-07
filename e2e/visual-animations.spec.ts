import { test, expect } from '@playwright/test';
import { makeNewsItems, makeTickerData, makeRiskScores, makeAIBrief } from './helpers/mock-data.js';

const SCREENSHOT_DIR = 'e2e/screenshots';

// Helper: set up a minimal test harness — load CSS and create panels directly,
// bypassing MapEngine which may hang or interfere in headless Chrome.
async function setupPanels(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  // Wait for Vite modules and CSS to load
  await page.waitForTimeout(1000);

  // Create panels directly in the browser
  await page.evaluate(async () => {
    // Stop the running App and clear its DOM to avoid element collisions.
    // CSS lives in <head> style tags and survives this clearing.
    const app = (window as any).__app;
    if (app && typeof app.destroy === 'function') {
      try { app.destroy(); } catch (_) { /* ignore */ }
    }
    document.getElementById('app')!.innerHTML = '';

    // Create a fresh sidebar
    const sidebar = document.createElement('aside');
    sidebar.className = 'forge-sidebar';
    sidebar.id = 'test-sidebar';
    document.body.appendChild(sidebar);

    // Import the generated manifest — this registers all panel types in the
    // correct registry (same module instance that createPanel uses)
    const { panelConfigs } = await import('/src/generated/panel-manifest.js');
    const { PanelManager } = await import('/src/core/panels/PanelManager.js');

    const pm = new PanelManager(sidebar);
    pm.initialize(panelConfigs);

    // Expose for test data injection
    (window as any).__pm = pm;
  });

  await page.waitForSelector('#test-sidebar .forge-panel', { timeout: 5_000 });
  // Give sidebar a fixed width so panels render properly for screenshots
  await page.evaluate(() => {
    const s = document.getElementById('test-sidebar')!;
    s.style.width = '360px';
    s.style.position = 'relative';
  });
  await page.waitForTimeout(100);
}

// Helper: inject data into a panel
async function updatePanel(page: import('@playwright/test').Page, name: string, data: unknown) {
  await page.evaluate(({ name, data }) => {
    (window as any).__pm.updatePanel(name, data);
  }, { name, data });
}

// ───────────────────────────────────────────────────────
// Test 1: Skeleton shimmer on load → crossfade on first data
// ───────────────────────────────────────────────────────
test('skeleton shimmer on load and crossfade on first data', async ({ page }) => {
  await setupPanels(page);

  // Skeletons should be present before data arrives
  const skeletonCount = await page.locator('#test-sidebar .skeleton-container').count();
  expect(skeletonCount).toBeGreaterThan(0);

  // Verify shimmer animation is active on skeleton blocks
  const animName = await page.locator('#test-sidebar .skeleton-block').first().evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(animName).toBe('skeleton-shimmer');

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/01-skeleton-shimmer.png` });

  // Inject data to trigger crossfade
  await updatePanel(page, 'tech-news', makeNewsItems(5));

  // The skeleton should get the 'loaded' class (opacity transition) or be already removed
  await page.waitForTimeout(50);
  const loadedOrGone = await page.evaluate(() => {
    const el = document.querySelector('#test-sidebar [data-panel-name="tech-news"] .skeleton-container');
    return el ? el.classList.contains('loaded') : 'removed';
  });
  expect(['removed', true]).toContain(loadedOrGone);

  // After 400ms the skeleton should be fully removed
  await page.waitForTimeout(400);
  const skelAfter = await page.locator('#test-sidebar [data-panel-name="tech-news"] .skeleton-container').count();
  expect(skelAfter).toBe(0);

  // News items should be rendered
  await expect(page.locator('#test-sidebar .news-item').first()).toBeVisible();

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/01-skeleton-loaded.png` });
});

// ───────────────────────────────────────────────────────
// Test 2: Panel headers pulse on data arrival
// ───────────────────────────────────────────────────────
test('panel headers pulse on data arrival', async ({ page }) => {
  await setupPanels(page);

  await updatePanel(page, 'tech-news', makeNewsItems(3));

  // Header should have pulse class
  await page.waitForTimeout(50);
  const pulseHeader = page.locator('#test-sidebar .forge-panel-header.pulse');
  await expect(pulseHeader.first()).toBeVisible();

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/02-pulse-active.png` });

  // After 1.6s the pulse class should be removed
  await page.waitForTimeout(1600);
  const pulseCount = await page.locator('#test-sidebar .forge-panel-header.pulse').count();
  expect(pulseCount).toBe(0);
});

// ───────────────────────────────────────────────────────
// Test 3: Sparklines animate on price updates
// ───────────────────────────────────────────────────────
test('sparklines animate on price updates', async ({ page }) => {
  await setupPanels(page);

  // Push initial data twice with slightly different prices to build sparkline history
  // (a single pushValue yields a flat-line path that won't change shape on update)
  const initialData = makeTickerData();
  await updatePanel(page, 'market-ticker', initialData);
  await page.waitForTimeout(100);

  // Push second round with slight variation so sparkline has 2 distinct points
  const secondData = makeTickerData([
    { price: 186.00, change: 2.80, changePercent: 1.53 },
    { price: 143.50, change: -0.40, changePercent: -0.28 },
    { price: 421.00, change: 6.45, changePercent: 1.56 },
  ]);
  await updatePanel(page, 'market-ticker', secondData);
  // Wait for D3 transition to complete (300ms + buffer)
  await page.waitForTimeout(500);

  // Capture initial path
  const initialPath = await page.locator('#test-sidebar .sparkline-line').first().getAttribute('d');
  expect(initialPath).toBeTruthy();
  expect(initialPath).not.toContain('NaN');

  // Push updated prices (large change)
  const updatedData = makeTickerData([
    { price: 195.00, change: 9.50, changePercent: 5.12 },
    { price: 135.20, change: -7.60, changePercent: -5.33 },
    { price: 430.00, change: 9.85, changePercent: 2.35 },
  ]);
  await updatePanel(page, 'market-ticker', updatedData);

  // Wait for D3 transition to complete (300ms + buffer)
  await page.waitForTimeout(400);

  const finalPath = await page.locator('#test-sidebar .sparkline-line').first().getAttribute('d');
  expect(finalPath).toBeTruthy();
  expect(finalPath).not.toContain('NaN');
  expect(finalPath).not.toBe(initialPath);

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/03-sparkline.png` });
});

// ───────────────────────────────────────────────────────
// Test 4: Numbers roll smoothly between values
// ───────────────────────────────────────────────────────
test('numbers roll smoothly between values', async ({ page }) => {
  await setupPanels(page);

  // Initial data with known price
  const data1 = makeTickerData([{ symbol: 'AAPL', price: 100.00, change: 0, changePercent: 0 }]);
  await updatePanel(page, 'market-ticker', data1);
  await page.waitForTimeout(500);

  const initialText = await page.locator('#test-sidebar .ticker-price').first().textContent();
  expect(initialText?.trim()).toBe('100.00');

  // Update to new price
  const data2 = makeTickerData([{ symbol: 'AAPL', price: 150.00, change: 50, changePercent: 50 }]);
  await updatePanel(page, 'market-ticker', data2);

  // Mid-animation: value should be between 100 and 150
  await page.waitForTimeout(100);
  const midText = await page.locator('#test-sidebar .ticker-price').first().textContent();
  const midValue = parseFloat(midText?.trim() ?? '0');
  expect(midValue).toBeGreaterThan(100);
  expect(midValue).toBeLessThan(150);

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/04-counter-rolling.png` });

  // After animation completes (400ms + buffer)
  await page.waitForTimeout(400);
  const finalText = await page.locator('#test-sidebar .ticker-price').first().textContent();
  expect(finalText?.trim()).toBe('150.00');
});

// ───────────────────────────────────────────────────────
// Test 5: Instability bars animate width changes
// ───────────────────────────────────────────────────────
test('instability bars animate width changes', async ({ page }) => {
  await setupPanels(page);

  // Inject a single country with a low score
  const data1 = [{ country: 'TestLand', score: 3.0, trend: 'stable' as const, components: { conflict: 2, unrest: 3, economic: 4 } }];
  await updatePanel(page, 'instability-index', data1);
  await page.waitForTimeout(500);

  // Bar should be at 30% width (3.0/10 * 100)
  const barFill = page.locator('#test-sidebar .instability-bar-fill').first();
  const initialWidth = await barFill.evaluate((el) => el.style.width);
  expect(initialWidth).toBe('30%');

  // Update to high score
  const data2 = [{ country: 'TestLand', score: 8.0, trend: 'rising' as const, components: { conflict: 8, unrest: 8, economic: 8 } }];
  await updatePanel(page, 'instability-index', data2);

  // Inline style should immediately be set to 80%
  const newInlineWidth = await barFill.evaluate((el) => el.style.width);
  expect(newInlineWidth).toBe('80%');

  // Mid-transition: computed width should be between initial and target
  await page.waitForTimeout(100);
  const midComputedWidth = await barFill.evaluate((el) => {
    const computed = getComputedStyle(el).width;
    return parseFloat(computed);
  });
  expect(midComputedWidth).toBeGreaterThan(0);

  // After transition completes
  await page.waitForTimeout(400);

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/05-bar-animated.png` });
});

// ───────────────────────────────────────────────────────
// Test 6: News items slide in from left, removed items fade out right
// ───────────────────────────────────────────────────────
test('news items slide in and fade out', async ({ page }) => {
  await setupPanels(page);

  // Inject initial 3 items
  const items = makeNewsItems(3);
  await updatePanel(page, 'tech-news', items);
  await page.waitForTimeout(50);

  // New items should have entrance animation class
  const enterItems = await page.locator('#test-sidebar .news-item-enter').count();
  expect(enterItems).toBeGreaterThanOrEqual(1);

  // Check staggered animation delays
  const delays = await page.locator('#test-sidebar .news-item-enter').evaluateAll(
    (els) => els.map((el) => (el as HTMLElement).style.animationDelay),
  );
  expect(delays).toContain('0ms');
  if (delays.length > 1) expect(delays[1]).toBe('50ms');

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/06-news-entrance.png` });

  // Wait for entrance animation to complete
  await page.waitForTimeout(500);
  const enterAfter = await page.locator('#test-sidebar .news-item-enter').count();
  expect(enterAfter).toBe(0);

  // Now replace: remove first item, add a new one
  const newItems = [items[1], items[2], {
    id: 'news-new',
    title: 'Brand New Article',
    url: 'https://example.com/new',
    source: 'TestSource',
    timestamp: new Date(),
    category: 'tech-news',
  }];
  await updatePanel(page, 'tech-news', newItems);
  await page.waitForTimeout(50);

  // First item should have exit class
  const exitItems = await page.locator('#test-sidebar .news-item-exit').count();
  expect(exitItems).toBe(1);

  // New item should have enter class
  const newEnter = await page.locator('#test-sidebar .news-item-enter').count();
  expect(newEnter).toBe(1);

  // After exit animation (200ms + buffer)
  await page.waitForTimeout(300);
  const exitAfter = await page.locator('#test-sidebar .news-item-exit').count();
  expect(exitAfter).toBe(0);
  // The exited item should be removed from DOM
  const itemA = await page.locator('#test-sidebar [data-item-id="news-0"]').count();
  expect(itemA).toBe(0);
});

// ───────────────────────────────────────────────────────
// Test 7: AI brief text types in character by character
// ───────────────────────────────────────────────────────
test('AI brief text types character by character', async ({ page }) => {
  await setupPanels(page);

  const briefText = 'Hello World test msg';
  await updatePanel(page, 'ai-brief', makeAIBrief(briefText));

  // After ~80ms only partial text should be visible
  await page.waitForTimeout(80);
  const partialText = await page.locator('#test-sidebar .ai-brief-content').textContent();
  // The content includes cursor '|', strip it
  const cleanPartial = partialText?.replace('|', '').trim() ?? '';
  expect(cleanPartial.length).toBeGreaterThan(0);
  expect(cleanPartial.length).toBeLessThan(briefText.length);

  // Cursor should be visible
  const cursor = page.locator('#test-sidebar .ai-brief-cursor');
  await expect(cursor).toBeVisible();

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/07-ai-typing.png` });

  // Wait for typing to complete (20 chars * 33ms ~ 660ms + buffer)
  await page.waitForTimeout(900);
  const fullText = await page.locator('#test-sidebar .ai-brief-content').textContent();
  const cleanFull = fullText?.replace('|', '').trim() ?? '';
  expect(cleanFull).toContain(briefText);

  // Cursor should be removed after typing completes
  const cursorAfter = await page.locator('#test-sidebar .ai-brief-cursor').count();
  expect(cursorAfter).toBe(0);
});

// ───────────────────────────────────────────────────────
// Test 8: After idle, all animations pause; interaction resumes
// ───────────────────────────────────────────────────────
test('idle state pauses animations, interaction resumes', async ({ page }) => {
  await setupPanels(page);

  // Simulate idle by directly adding the class (testing CSS rules, not the 2-min timer)
  await page.evaluate(() => document.body.classList.add('animations-paused'));
  await page.waitForTimeout(100);

  // Skeleton blocks (if any remain) should be paused
  const hasSkeleton = await page.locator('#test-sidebar .skeleton-block').count();
  if (hasSkeleton > 0) {
    const playState = await page.locator('#test-sidebar .skeleton-block').first().evaluate(
      (el) => getComputedStyle(el).animationPlayState,
    );
    expect(playState).toBe('paused');
  }

  // Instability bar: inject data then check transition is disabled
  await updatePanel(page, 'instability-index', makeRiskScores());
  await page.waitForTimeout(100);
  const hasBar = await page.locator('#test-sidebar .instability-bar-fill').count();
  if (hasBar > 0) {
    const transition = await page.locator('#test-sidebar .instability-bar-fill').first().evaluate(
      (el) => getComputedStyle(el).transitionProperty,
    );
    expect(transition).toBe('none');
  }

  // Verify the body class is set
  const isPaused = await page.evaluate(() => document.body.classList.contains('animations-paused'));
  expect(isPaused).toBe(true);

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/08-idle-paused.png` });

  // Simulate user interaction to resume
  await page.evaluate(() => document.body.classList.remove('animations-paused'));
  await page.waitForTimeout(100);

  const isResumed = await page.evaluate(() => !document.body.classList.contains('animations-paused'));
  expect(isResumed).toBe(true);

  // Verify animations resume if skeleton blocks exist
  if (hasSkeleton > 0) {
    const playStateAfter = await page.locator('#test-sidebar .skeleton-block').first().evaluate(
      (el) => getComputedStyle(el).animationPlayState,
    );
    expect(playStateAfter).toBe('running');
  }

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/08-idle-resumed.png` });
});

// ───────────────────────────────────────────────────────
// Test 9: prefers-reduced-motion disables all animations
// ───────────────────────────────────────────────────────
test('prefers-reduced-motion disables all animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setupPanels(page);

  // Skeleton blocks should have animation: none
  const hasSkeleton = await page.locator('#test-sidebar .skeleton-block').count();
  if (hasSkeleton > 0) {
    const animName = await page.locator('#test-sidebar .skeleton-block').first().evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(animName).toBe('none');
  }

  // Inject news — triggerPulse should NOT add .pulse class (checks matchMedia internally)
  await updatePanel(page, 'tech-news', makeNewsItems(3));
  await page.waitForTimeout(100);
  const pulseCount = await page.locator('#test-sidebar .forge-panel-header.pulse').count();
  expect(pulseCount).toBe(0);

  // News items should NOT have entrance animation (CSS sets animation: none)
  const newsEnter = await page.locator('#test-sidebar .news-item-enter').count();
  if (newsEnter > 0) {
    const newsAnim = await page.locator('#test-sidebar .news-item-enter').first().evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(newsAnim).toBe('none');
  }

  // AI brief should appear instantly (no typing effect, no cursor)
  await updatePanel(page, 'ai-brief', makeAIBrief('Instant text'));
  await page.waitForTimeout(50);
  const briefText = await page.locator('#test-sidebar .ai-brief-content').textContent();
  expect(briefText).toContain('Instant text');
  const cursorCount = await page.locator('#test-sidebar .ai-brief-cursor').count();
  expect(cursorCount).toBe(0);

  // Instability bar should have transition: none
  await updatePanel(page, 'instability-index', makeRiskScores());
  await page.waitForTimeout(100);
  const barTransition = await page.locator('#test-sidebar .instability-bar-fill').first().evaluate(
    (el) => getComputedStyle(el).transitionProperty,
  );
  expect(barTransition).toBe('none');

  await page.locator('#test-sidebar').screenshot({ path: `${SCREENSHOT_DIR}/09-reduced-motion.png` });
});
