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
    // The product is H5 mobile only (PRD §3). The codebase has a wide-layout
    // branch for browser windows >= 768px, but it's a responsive courtesy,
    // not a delivery target — we don't gate on it here.
    //
    // Why the explicit `browserName: 'chromium'` override:
    //   `devices['iPhone 13']` ships `defaultBrowserType: 'webkit'`, so
    //   without the override the project name is misleading and CI
    //   (which only installs the chromium browser pack) crashes on
    //   "webkit executable doesn't exist". We take the iPhone 13 user-
    //   agent + viewport for realistic mobile rendering, then run them
    //   inside Chromium since that's both the H5 target engine class
    //   (Edge, mini-program webview) and the only browser CI installs.
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
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
