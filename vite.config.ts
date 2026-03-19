import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { apiDevPlugin } from './forge/src/vite/api-dev-plugin.js';
import { ogMetaPlugin } from './forge/src/vite/og-meta-plugin.js';

export default defineConfig({
  plugins: [apiDevPlugin(), ogMetaPlugin()],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/maplibre-gl/')) return 'maplibre';
          if (/\/node_modules\/d3[\w-]*\//.test(id)) return 'd3';
        },
      },
    },
  },
});
