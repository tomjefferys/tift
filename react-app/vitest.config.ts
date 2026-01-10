/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
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