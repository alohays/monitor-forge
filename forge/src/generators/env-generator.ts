import type { MonitorForgeConfig } from '../config/schema.js';

interface EnvVarDef {
  key: string;
  description: string;
  required: boolean;
  signupUrl?: string;
}

const AI_PROVIDER_SIGNUP_URLS: Record<string, string> = {
  groq: 'https://console.groq.com',
  openrouter: 'https://openrouter.ai/keys',
};

export function generateEnvExample(config: MonitorForgeConfig): string {
  const vars = collectEnvVars(config);
  return vars
    .map(v => {
      const label = v.required ? '(required)' : '(optional)';
      const signup = v.signupUrl ? ` — sign up at ${v.signupUrl}` : '';
      return `# ${v.description} ${label}${signup}\n${v.key}=`;
    })
    .join('\n\n') + '\n';
}

function collectEnvVars(config: MonitorForgeConfig): EnvVarDef[] {
  const vars: EnvVarDef[] = [];

  // AI providers — required only when AI is enabled AND provider is in fallback chain
  for (const [name, provider] of Object.entries(config.ai.providers)) {
    vars.push({
      key: provider.apiKeyEnv,
      description: `${name} API key`,
      required: config.ai.enabled && config.ai.fallbackChain.includes(name),
      signupUrl: AI_PROVIDER_SIGNUP_URLS[name],
    });
  }

  // Cache
  if (config.backend.cache.provider === 'upstash-redis') {
    vars.push({ key: 'UPSTASH_REDIS_REST_URL', description: 'Upstash Redis REST URL', required: true });
    vars.push({ key: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash Redis REST token', required: true });
  } else if (config.backend.cache.provider === 'vercel-kv') {
    vars.push({ key: 'KV_REST_API_URL', description: 'Vercel KV REST API URL', required: true });
    vars.push({ key: 'KV_REST_API_TOKEN', description: 'Vercel KV REST API token', required: true });
  }

  // Source env vars
  for (const source of config.sources) {
    if (source.headers) {
      for (const value of Object.values(source.headers)) {
        const match = value.match(/\$\{env\.([A-Z_][A-Z0-9_]*)\}/);
        if (match) {
          vars.push({ key: match[1], description: `API key for source "${source.name}"`, required: true });
        }
      }
    }
  }

  return vars;
}
