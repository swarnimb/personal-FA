import { defineConfig, configDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'

// Integration project: runs the real PostgreSQL-backed financial SQL.
// Deliberately does NOT mock @/lib/db (unit tests mock it per-file). Separate
// run target so `npm test` stays unit-only and mock-only (TS-03).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // surfaces .env.local TEST_DATABASE_URL
  return {
    test: {
      environment: 'node',
      globals: true,
      include: ['src/__tests__/integration/**/*.integration.test.ts'],
      exclude: [...configDefaults.exclude],
      setupFiles: ['./src/__tests__/integration/setup.integration.ts'],
      env,
      hookTimeout: 60_000,
      testTimeout: 30_000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
