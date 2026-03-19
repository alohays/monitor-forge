export interface ProxyAuthConfig {
  envVar: string;
  header: string;
  scheme: 'bearer' | 'plain';
}

export function injectAuthHeader(
  headers: Record<string, string>,
  domain: string,
  proxyConfig: Record<string, ProxyAuthConfig>,
): Record<string, string> {
  const config = proxyConfig[domain];
  if (!config) return headers;

  const apiKey = process.env[config.envVar];
  if (!apiKey) return headers;

  const value = config.scheme === 'bearer' ? `Bearer ${apiKey}` : apiKey;
  return { ...headers, [config.header]: value };
}
