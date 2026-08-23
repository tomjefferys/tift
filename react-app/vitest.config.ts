/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { getBuildDefines } from './buildVersion';

export default defineConfig({
  define: getBuildDefines(),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'build'],
    css: false,
    env: {
      PUBLIC_URL: '',
      NODE_ENV: 'test',
      IS_REACT_ACT_ENVIRONMENT: 'true',
    },
    deps: {
      optimizer: {
        web: {
          include: ['react-markdown'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2020',
  },
});