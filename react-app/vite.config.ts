import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getBuildDefines } from './buildVersion';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    open: true,
  },
  define: getBuildDefines(),
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
});
