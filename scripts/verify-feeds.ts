#!/usr/bin/env npx tsx
/**
 * RSS Feed Verification Script
 *
 * Reads forge/data/rss-library.json, performs HTTP GET on each feed URL,
 * validates XML/RSS structure, updates verified status, and writes results back.
 *
 * Usage: npx tsx scripts/verify-feeds.ts [--concurrency N] [--timeout MS]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIBRARY_PATH = resolve(import.meta.dirname ?? '.', '..', 'forge', 'data', 'rss-library.json');
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_TIMEOUT_MS = 15_000;

interface FeedEntry {
  id: string;
  name: string;
  url: string;
  category: string;
  tier: number;
  verified: boolean;
  lastVerified?: string;
  [key: string]: unknown;
}

interface Library {
  schemaVersion: string;
  entries: FeedEntry[];
}

function parseArgs(): { concurrency: number; timeout: number } {
  const args = process.argv.slice(2);
  let concurrency = DEFAULT_CONCURRENCY;
  let timeout = DEFAULT_TIMEOUT_MS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { concurrency, timeout };
}

function isValidRss(text: string): boolean {
  // Check for common RSS/Atom/XML feed markers
  const lower = text.slice(0, 2000).toLowerCase();
  return (
    lower.includes('<rss') ||
    lower.includes('<feed') ||
    lower.includes('<rdf:rdf') ||
    (lower.includes('<?xml') && (lower.includes('<channel') || lower.includes('<entry')))
  );
}

async function verifyFeed(
  entry: FeedEntry,
  timeout: number,
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(entry.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'monitor-forge-feed-verifier/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { id: entry.id, success: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    if (!isValidRss(text)) {
      return { id: entry.id, success: false, error: 'Response is not valid RSS/Atom XML' };
    }

    return { id: entry.id, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: entry.id, success: false, error: message };
  }
}

async function processBatch(
  entries: FeedEntry[],
  concurrency: number,
  timeout: number,
): Promise<Map<string, { success: boolean; error?: string }>> {
  const results = new Map<string, { success: boolean; error?: string }>();
  const queue = [...entries];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const result = await verifyFeed(entry, timeout);
      results.set(result.id, { success: result.success, error: result.error });
      const status = result.success ? '\x1b[32mOK\x1b[0m' : `\x1b[31mFAIL\x1b[0m (${result.error})`;
      process.stdout.write(`  [${results.size}/${entries.length}] ${entry.id}: ${status}\n`);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

async function main(): Promise<void> {
  const { concurrency, timeout } = parseArgs();

  console.log('Reading RSS library...');
  const raw = readFileSync(LIBRARY_PATH, 'utf-8');
  const library: Library = JSON.parse(raw);

  console.log(`Found ${library.entries.length} feeds. Verifying with concurrency=${concurrency}, timeout=${timeout}ms...\n`);

  const results = await processBatch(library.entries, concurrency, timeout);

  // Update library entries with verification results
  const now = new Date().toISOString().split('T')[0];
  let verified = 0;
  let failed = 0;
  const tier1Failures: string[] = [];

  for (const entry of library.entries) {
    const result = results.get(entry.id);
    if (result) {
      entry.verified = result.success;
      entry.lastVerified = now;
      if (result.success) {
        verified++;
      } else {
        failed++;
        if (entry.tier === 1) {
          tier1Failures.push(`${entry.id}: ${result.error}`);
        }
      }
    }
  }

  // Write updated library back
  writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2) + '\n', 'utf-8');

  // Print summary
  console.log('\n--- Verification Summary ---');
  console.log(`Total:    ${library.entries.length}`);
  console.log(`Verified: \x1b[32m${verified}\x1b[0m`);
  console.log(`Failed:   \x1b[31m${failed}\x1b[0m`);

  if (tier1Failures.length > 0) {
    console.log(`\n\x1b[31mTier-1 failures (${tier1Failures.length}):\x1b[0m`);
    for (const f of tier1Failures) {
      console.log(`  - ${f}`);
    }
    console.log('\nExiting with non-zero status due to tier-1 failures.');
    process.exit(1);
  }

  console.log('\nAll tier-1 feeds passed. Library updated successfully.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
