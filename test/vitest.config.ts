import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Standalone test project config.
// Covers frontend unit/component tests and backend/API integration tests.
export default defineConfig({
  cacheDir: '../node_modules/.vite/vitest',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['*.{test,spec}.ts', 'testcases/*.{test,spec}.ts'],
  },
})
