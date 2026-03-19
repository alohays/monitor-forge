import type { Plugin } from 'vite';
import { loadConfig } from '../config/loader.js';

export function ogMetaPlugin(): Plugin {
  return {
    name: 'monitor-forge-og-meta',
    transformIndexHtml(html) {
      try {
        const config = loadConfig();
        const name = config.monitor.name;
        const description =
          config.monitor.description ||
          `Real-time intelligence dashboard built with monitor-forge`;
        const ogImage = config.monitor.branding?.ogImage;

        html = html.replace(
          /<meta property="og:title" content="[^"]*">/,
          `<meta property="og:title" content="${escapeHtml(name)}">`,
        );
        html = html.replace(
          /<meta property="og:description" content="[^"]*">/,
          `<meta property="og:description" content="${escapeHtml(description)}">`,
        );
        html = html.replace(
          /<meta name="twitter:title" content="[^"]*">/,
          `<meta name="twitter:title" content="${escapeHtml(name)}">`,
        );
        html = html.replace(
          /<meta name="twitter:description" content="[^"]*">/,
          `<meta name="twitter:description" content="${escapeHtml(description)}">`,
        );
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${escapeHtml(name)}</title>`,
        );

        // Handle og:image
        if (ogImage) {
          // Add og:image if not present, or replace existing
          if (html.includes('og:image')) {
            html = html.replace(
              /<meta property="og:image" content="[^"]*">/,
              `<meta property="og:image" content="${escapeHtml(ogImage)}">`,
            );
          } else {
            html = html.replace(
              '</head>',
              `  <meta property="og:image" content="${escapeHtml(ogImage)}">\n  <meta name="twitter:image" content="${escapeHtml(ogImage)}">\n</head>`,
            );
          }
        } else {
          // Remove og:image if present but not configured
          html = html.replace(/<meta property="og:image" content="[^"]*">\n?/g, '');
          html = html.replace(/<meta name="twitter:image" content="[^"]*">\n?/g, '');
        }

        return html;
      } catch {
        // If config can't be loaded (e.g., no config file), return html unchanged
        return html;
      }
    },
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
