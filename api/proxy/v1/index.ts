import { corsHeaders, handleCors } from '../../_shared/cors.js';
import { getCached } from '../../_shared/cache.js';
import { jsonResponse, errorResponse } from '../../_shared/error.js';
import { isDomainAllowed } from '../../_shared/domain-match.js';
import { injectAuthHeader } from '../../_shared/key-injection.js';
import { PROXY_ALLOWED_DOMAINS, CORS_ALLOWED_ORIGINS } from '../../_shared/proxy-allowlist.js';
import { proxyConfig, sourceTtl } from '../../_shared/proxy-config.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const corsResponse = handleCors(request, CORS_ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  const cors = corsHeaders(request, CORS_ALLOWED_ORIGINS);
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return errorResponse(400, 'Missing "url" query parameter', cors);
  }

  try {
    const targetParsed = new URL(targetUrl);

    // Only allow HTTP(S) protocols
    if (!['http:', 'https:'].includes(targetParsed.protocol)) {
      return errorResponse(403, 'Only HTTP and HTTPS protocols are allowed', cors);
    }

    // Block private IPs
    if (isPrivateIP(targetParsed.hostname)) {
      return errorResponse(403, 'Cannot proxy to private IP addresses', cors);
    }

    // Enforce domain allowlist
    if (!isTargetDomainAllowed(targetParsed.hostname)) {
      return errorResponse(403, 'Domain not in proxy allowlist', cors);
    }

    // Resolve TTL: ?ttl= query param > source-level cacheTtl > default 300
    const sourceName = url.searchParams.get('source');
    const ttlParam = url.searchParams.get('ttl');
    const rawTtl = ttlParam != null ? parseInt(ttlParam, 10) : null;
    const cacheTtl = (rawTtl != null && Number.isFinite(rawTtl) && rawTtl > 0)
      ? Math.min(rawTtl, 86400)  // cap at 24 hours
      : (sourceName && sourceTtl[sourceName] != null ? sourceTtl[sourceName] : 300);

    // Inject server-side API key if configured for this domain
    const baseHeaders: Record<string, string> = { 'User-Agent': 'MonitorForge/1.0' };
    const fetchHeaders = injectAuthHeader(baseHeaders, targetParsed.hostname, proxyConfig);

    const data = await getCached(`proxy:${targetUrl}`, cacheTtl, async () => {
      const response = await fetch(targetUrl, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Upstream returned ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('json')) {
        return response.json();
      }
      return response.text();
    });

    return jsonResponse(data, 200, cors);
  } catch (err) {
    return errorResponse(502, `Proxy error: ${err}`, cors);
  }
}

function isTargetDomainAllowed(hostname: string): boolean {
  if (process.env.PROXY_ALLOW_ALL === 'true') {
    return true;
  }
  if (PROXY_ALLOWED_DOMAINS.length === 0) {
    return false;
  }
  return isDomainAllowed(hostname, PROXY_ALLOWED_DOMAINS);
}

function isPrivateIP(hostname: string): boolean {
  // Strip IPv6 brackets if present
  const h = hostname.replace(/^\[|\]$/g, '');
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1|::ffff:|169\.254\.|[fF][cCdD]|[fF][eE][89aAbB])/i.test(h);
}
