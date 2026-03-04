import { handleCors } from '../../_shared/cors.js';
import { getCached } from '../../_shared/cache.js';
import { jsonResponse, errorResponse } from '../../_shared/error.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return errorResponse(400, 'Missing "url" query parameter');
  }

  try {
    const targetParsed = new URL(targetUrl);

    // Only allow HTTP(S) protocols
    if (!['http:', 'https:'].includes(targetParsed.protocol)) {
      return errorResponse(403, 'Only HTTP and HTTPS protocols are allowed');
    }

    // Block private IPs
    if (isPrivateIP(targetParsed.hostname)) {
      return errorResponse(403, 'Cannot proxy to private IP addresses');
    }

    const cacheTtl = parseInt(url.searchParams.get('ttl') ?? '300', 10);

    const data = await getCached(`proxy:${targetUrl}`, cacheTtl, async () => {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'MonitorForge/1.0' },
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

    return jsonResponse(data);
  } catch (err) {
    return errorResponse(502, `Proxy error: ${err}`);
  }
}

function isPrivateIP(hostname: string): boolean {
  // Strip IPv6 brackets if present
  const h = hostname.replace(/^\[|\]$/g, '');
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1|::ffff:|169\.254\.|[fF][cCdD]|[fF][eE][89aAbB])/i.test(h);
}
