import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    // Integration tests run via vitest.integration.config.ts (TS-03) — keep
    // `npm test` unit-only and mock-only.
    exclude: [...configDefaults.exclude, 'src/__tests__/integration/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
