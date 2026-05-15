import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) =>
          tag === 'scroll-view' ||
          tag === 'view' ||
          tag === 'image' ||
          tag === 'text' ||
          tag === 'button' ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'picker' ||
          tag === 'navigator' ||
          tag.includes('-'),
      },
    },
  })],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['*.test.ts'],
    pool: 'vmThreads',
    execArgv: ['--experimental-vm-modules'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
  },
})
