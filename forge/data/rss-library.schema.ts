import { z } from 'zod';

export const RssLibraryEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  url: z.string().url(),
  category: z.enum([
    'politics', 'us', 'europe', 'middleeast', 'africa', 'latam', 'asia',
    'tech', 'ai', 'startups', 'security', 'finance', 'crypto', 'commodities',
    'defense', 'thinktanks', 'crisis', 'energy', 'climate', 'happy',
  ]),
  language: z.string().default('en'),
  tier: z.number().int().min(1).max(4),
  tags: z.array(z.string()).default([]),
  region: z.string().optional(),
  fallbackUrl: z.string().url().optional(),
  propagandaRisk: z.enum(['none', 'low', 'medium', 'high']),
  description: z.string(),
  lastVerified: z.string().optional(),
  verified: z.boolean().default(false),
});

export const RssLibrarySchema = z.object({
  schemaVersion: z.literal('1'),
  entries: z.array(RssLibraryEntrySchema),
});

export type RssLibraryEntry = z.infer<typeof RssLibraryEntrySchema>;
export type RssLibrary = z.infer<typeof RssLibrarySchema>;
