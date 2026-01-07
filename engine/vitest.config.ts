import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [],
        include: ['out/test/**/*.js'],
        exclude: ['out/test/testutils/**/*.js'],
    },
});