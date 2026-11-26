import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
