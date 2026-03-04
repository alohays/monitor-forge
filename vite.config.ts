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
        manualChunks: {
          maplibre: ['maplibre-gl'],
          d3: ['d3'],
        },
      },
    },
  },
});
