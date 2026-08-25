import { defineConfig } from 'vitest/config';
import path from 'node:path';

const rls = process.env.RUN_S02_RLS === '1';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
    // Local Supabase A/B suites must not share mutable users/objects in parallel.
    fileParallelism: rls ? false : true,
    maxWorkers: rls ? 1 : undefined,
  },
});
