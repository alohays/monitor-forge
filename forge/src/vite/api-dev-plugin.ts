import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Resolve a URL path like "/api/news/v1" to the handler file under api/.
 * Returns the absolute path to the handler .ts file, or null if not found.
 */
function resolveHandlerPath(urlPath: string, projectRoot: string): string | null {
  const relative = urlPath.replace(/^\/api\//, '');

  // Skip _shared and other underscore-prefixed segments
  if (relative.split('/').some(seg => seg.startsWith('_'))) {
    return null;
  }

  // Try: api/<relative>/index.ts
  const dirCandidate = resolve(projectRoot, 'api', relative, 'index.ts');
  if (existsSync(dirCandidate)) return dirCandidate;

  // Try: api/<relative>.ts
  const fileCandidate = resolve(projectRoot, 'api', `${relative}.ts`);
  if (existsSync(fileCandidate)) return fileCandidate;

  return null;
}

/**
 * Convert a Node.js IncomingMessage to a Web Request.
 */
async function nodeReqToWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost:5173';
  const url = new URL(req.url ?? '/', `http://${host}`);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  let body: ReadableStream<Uint8Array> | null = null;

  if (hasBody) {
    body = new ReadableStream({
      start(controller) {
        req.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        req.on('end', () => controller.close());
        req.on('error', (err) => controller.error(err));
      },
    });
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url.toString(), {
    method: req.method ?? 'GET',
    headers,
    body,
    // Node 18+ requires duplex for streaming request bodies
    ...(hasBody ? { duplex: 'half' as const } : {}),
  } as RequestInit);
}

/**
 * Write a Web Response back to a Node.js ServerResponse.
 */
async function webResponseToNodeRes(
  webResponse: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = webResponse.status;

  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  res.end();
}

/**
 * Vite plugin that serves API routes locally during development.
 * Intercepts /api/* requests and calls the Edge Function handlers directly,
 * eliminating the need for a separate API server.
 */
export function apiDevPlugin(): Plugin {
  return {
    name: 'monitor-forge-api-dev',

    config(_, { mode }) {
      // Load all env vars (not just VITE_-prefixed) into process.env
      // so API handlers can access keys like GROQ_API_KEY
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void,
      ) => {
        const url = req.url ?? '';

        if (!url.startsWith('/api/')) {
          return next();
        }

        const pathname = url.split('?')[0];

        const projectRoot = server.config.root;
        const handlerPath = resolveHandlerPath(pathname, projectRoot);

        if (!handlerPath) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `No API handler found for ${pathname}` }));
          return;
        }

        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: `Handler at ${pathname} does not export a default function`,
            }));
            return;
          }

          const webRequest = await nodeReqToWebRequest(req);
          const webResponse: Response = await handler(webRequest);
          await webResponseToNodeRes(webResponse, res);
        } catch (err) {
          console.error(`[api-dev] Error in ${pathname}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: `Internal server error: ${err instanceof Error ? err.message : String(err)}`,
            }));
          }
        }
      });
    },
  };
}
