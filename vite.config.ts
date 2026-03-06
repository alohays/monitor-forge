import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { apiDevPlugin } from './forge/src/vite/api-dev-plugin.js';

export default defineConfig({
  plugins: [apiDevPlugin()],
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
