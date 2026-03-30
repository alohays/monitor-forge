import { z } from 'zod';

export const ApiEndpointSchema = z.object({
  path: z.string(),
  method: z.enum(['GET', 'POST']).default('GET'),
  params: z.record(z.string()).default({}),
  transform: z.string().optional(),
  interval: z.number().int().min(10).default(300),
  description: z.string().optional(),
});

export const ApiTemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string(),
  provider: z.string(),
  baseUrl: z.string().url(),
  endpoints: z.array(ApiEndpointSchema).min(1),
  authType: z.enum(['none', 'api-key', 'bearer', 'oauth']),
  authEnvVar: z.string().regex(/^[A-Z_][A-Z0-9_]*$/).optional(),
  rateLimit: z.object({
    requests: z.number().int().min(1),
    windowSeconds: z.number().int().min(1),
  }),
  responseFormat: z.enum(['json', 'xml', 'geojson']).default('json'),
  category: z.string(),
  tier: z.number().int().min(1).max(4).default(2),
  proxyRequired: z.boolean().default(false),
  docsUrl: z.string().url().optional(),
});

export const ApiTemplatesSchema = z.object({
  schemaVersion: z.literal('1'),
  templates: z.array(ApiTemplateSchema),
});

export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;
export type ApiTemplate = z.infer<typeof ApiTemplateSchema>;
export type ApiTemplates = z.infer<typeof ApiTemplatesSchema>;
