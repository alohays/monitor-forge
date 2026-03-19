import { z } from 'zod';

// ─── Source Schema ──────────────────────────────────────────

export const SourceSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  type: z.enum(['rss', 'rest-api', 'websocket']),
  url: z.string().url().refine(u => /^(https?|wss?):\/\//i.test(u), 'URL must use http(s) or ws(s) protocol'),
  category: z.string().min(1),
  tier: z.number().int().min(1).max(4).default(3),
  interval: z.number().int().min(10).default(300),
  language: z.string().default('en'),
  tags: z.array(z.string()).default([]),
  headers: z.record(z.string()).optional(),
  transform: z.string().optional(),
  authEnvVar: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Must be a valid env var name (UPPER_SNAKE_CASE)').optional(),
  authHeader: z.string().default('Authorization'),
  cacheTtl: z.number().min(0).default(300),
});

export type SourceConfig = z.infer<typeof SourceSchema>;

// ─── Layer Schema ───────────────────────────────────────────

export const LayerDataSchema = z.object({
  source: z.enum(['static', 'api', 'source-ref']),
  path: z.string().optional(),
  url: z.string().url().optional(),
  sourceRef: z.string().optional(),
});

export const LayerSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  type: z.enum(['points', 'lines', 'polygons', 'heatmap', 'hexagon']),
  displayName: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex code'),
  data: LayerDataSchema,
  defaultVisible: z.boolean().default(false),
  category: z.string().min(1),
});

export type LayerConfig = z.infer<typeof LayerSchema>;

// ─── Panel Schema ───────────────────────────────────────────

export const PanelSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  type: z.enum([
    'ai-brief',
    'news-feed',
    'market-ticker',
    'entity-tracker',
    'instability-index',
    'service-status',
    'custom',
  ]),
  displayName: z.string().min(1),
  position: z.number().int().min(0),
  config: z.record(z.unknown()).default({}),
  customModule: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/, 'Must be PascalCase class name').optional(),
}).refine(
  (p) => p.type !== 'custom' || !!p.customModule,
  { message: 'customModule is required for custom panels', path: ['customModule'] },
);

export type PanelConfig = z.infer<typeof PanelSchema>;

// ─── View Schema ───────────────────────────────────────────

export const ViewSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1),
  panels: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  icon: z.string().optional(),
  default: z.boolean().optional(),
});

export type ViewConfig = z.infer<typeof ViewSchema>;

// ─── AI Schema ──────────────────────────────────────────────

export const AIProviderSchema = z.object({
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  baseUrl: z.string().url().optional(),
});

export const AIAnalysisSchema = z.object({
  summarization: z.boolean().default(true),
  entityExtraction: z.boolean().default(true),
  sentimentAnalysis: z.boolean().default(true),
  focalPointDetection: z.boolean().default(false),
  customPrompt: z.string().optional(),
});

export const AISchema = z.object({
  enabled: z.boolean().default(true),
  fallbackChain: z.array(z.string()).default(['groq', 'openrouter']),
  providers: z.record(AIProviderSchema).default({}),
  analysis: AIAnalysisSchema.default({}),
});

// ─── Map Schema ─────────────────────────────────────────────

export const MapSchema = z.object({
  style: z.string().url().default('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'),
  center: z.tuple([z.number(), z.number()]).default([0, 20]),
  zoom: z.number().default(3),
  minZoom: z.number().default(2),
  maxZoom: z.number().default(18),
  projection: z.enum(['mercator', 'globe']).default('mercator'),
  dayNightOverlay: z.boolean().default(false),
  atmosphericGlow: z.boolean().default(true),
  idleRotation: z.boolean().default(true),
  idleRotationSpeed: z.number().min(0).max(5).default(0.5),
});

// ─── Backend Schema ─────────────────────────────────────────

export const CacheSchema = z.object({
  provider: z.enum(['upstash-redis', 'vercel-kv', 'memory']).default('memory'),
  ttlSeconds: z.number().default(300),
});

export const RateLimitSchema = z.object({
  enabled: z.boolean().default(true),
  maxRequests: z.number().default(100),
  windowSeconds: z.number().default(60),
});

export const CorsProxySchema = z.object({
  enabled: z.boolean().default(true),
  allowedDomains: z.array(z.string()).default(['*']),
  corsOrigins: z.array(z.string()).default(['*']),
});

export const BackendSchema = z.object({
  cache: CacheSchema.default({}),
  rateLimit: RateLimitSchema.default({}),
  corsProxy: CorsProxySchema.default({}),
});

// ─── Build Schema ───────────────────────────────────────────

export const BuildSchema = z.object({
  target: z.enum(['vercel', 'static', 'node']).default('vercel'),
  outDir: z.string().default('dist'),
});

// ─── Branding Schema ────────────────────────────────────────

export const BrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0052CC'),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  ogImage: z.string().url().optional(),
});

// ─── Theme Schema ───────────────────────────────────────────

export const ThemeColorsSchema = z.object({
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentHover: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const ThemeSchema = z.object({
  mode: z.enum(['dark', 'light', 'auto']).default('dark'),
  palette: z.enum(['default', 'ocean', 'forest', 'sunset', 'midnight', 'cyberpunk', 'minimal']).default('default'),
  colors: ThemeColorsSchema.default({}),
  panelPosition: z.enum(['right', 'left']).default('right'),
  panelWidth: z.number().int().min(200).max(800).default(380),
  compactMode: z.boolean().default(false),
});

// ─── Monitor (Identity) Schema ──────────────────────────────

export const MonitorSchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(256).default(''),
  domain: z.string().min(1),
  tags: z.array(z.string()).default([]),
  branding: BrandingSchema.default({}),
});

// ─── Root Config Schema ─────────────────────────────────────

export const MonitorForgeConfigSchema = z.object({
  version: z.string().default('1'),
  monitor: MonitorSchema,
  sources: z.array(SourceSchema).default([]),
  layers: z.array(LayerSchema).default([]),
  panels: z.array(PanelSchema).default([]),
  views: z.array(ViewSchema).default([]),
  ai: AISchema.default({}),
  map: MapSchema.default({}),
  backend: BackendSchema.default({}),
  build: BuildSchema.default({}),
  theme: ThemeSchema.default({}),
});

export type MonitorForgeConfig = z.infer<typeof MonitorForgeConfigSchema>;

export function defineConfig(config: MonitorForgeConfig): MonitorForgeConfig {
  return MonitorForgeConfigSchema.parse(config);
}
