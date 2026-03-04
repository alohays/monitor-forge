export function corsHeaders(request?: Request, allowedOrigins?: readonly string[]): Record<string, string> {
  let origin = '*';

  if (request && allowedOrigins && !allowedOrigins.includes('*')) {
    const requestOrigin = request.headers.get('Origin');
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      origin = requestOrigin;
    } else if (requestOrigin) {
      origin = 'null';
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request: Request, allowedOrigins?: readonly string[]): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigins) });
  }
  return null;
}
