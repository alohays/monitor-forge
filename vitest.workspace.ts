import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'forge',
      include: ['forge/**/*.test.ts'],
      environment: 'node',
    },
    resolve: {
      alias: {
        '@forge': new URL('./forge/src', import.meta.url).pathname,
      },
    },
  },
  {
    test: {
      name: 'api',
      include: ['api/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'frontend',
      include: ['src/**/*.test.ts'],
      environment: 'happy-dom',
    },
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
  {
    test: {
      name: 'integration',
      include: ['test/**/*.test.ts'],
      environment: 'node',
    },
    resolve: {
      alias: {
        '@forge': new URL('./forge/src', import.meta.url).pathname,
      },
    },
  },
]);
