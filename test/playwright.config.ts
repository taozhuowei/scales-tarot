import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end tests.
 *
 * - Tests live in test/e2e/*.spec.ts and run against the real server
 *   (Express + bundled H5 SPA at http://localhost:3000).
 * - The webServer block boots `npm run start:prod` automatically; locally
 *   it is reused if you already have one running, in CI it is always
 *   started fresh so the build under test is exercised.
 * - chromium-only by default — CI cost grows linearly per project, and
 *   the H5 target is rendered by Chromium-class engines (Edge, mini
 *   program webview). Add Firefox/WebKit only if a regression motivates it.
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — the divination flow mutates server state
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // PRD §3 declares mobile H5 as the primary delivery target. Desktop
    // layout exists but has known pointer-event ordering issues in result
    // mode (ActionBar intercepted by stage-container) — out of scope for
    // these regression tests until that's addressed.
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'npm run start:prod',
    url: 'http://localhost:3000/api/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    cwd: '..',
  },
})
