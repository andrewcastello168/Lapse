import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    testTimeout: 30000,
    hookTimeout: 60000,
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
