import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end tests.
 *
 * - Tests live in app/test/e2e/*.spec.ts and run against the real server
 *   (Express + bundled H5 SPA at http://localhost:4124).
 * - The webServer block boots `node server/dist/server.js` directly with
 *   NODE_ENV=production; locally it is reused if you already have one
 *   running, in CI it is always started fresh so the build under test is
 *   exercised. We invoke node directly (no `npm run start:prod`) to avoid
 *   an implicit dependency on package.json scripts during the test run.
 * - chromium-only by default — CI cost grows linearly per project, and
 *   the H5 target is rendered by Chromium-class engines (Edge, mini
 *   program webview). Add Firefox/WebKit only if a regression motivates it.
 */

export default defineConfig({
  testDir: './test/e2e',
  // Artifacts live under dist/ (the unified build/artifact root). Paths are
  // resolved relative to this config file (in app/), so '../dist/...' points
  // at the repo-root dist/. Phase 10b unified these from the prior
  // playwright-report/ + test-results/ scattered root layout.
  outputDir: '../dist/test-results',
  fullyParallel: false, // sequential — the divination flow mutates server state
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../dist/playwright-report' }]]
    : 'list',

  use: {
    baseURL: 'http://localhost:4124',
    trace: 'retain-on-failure',
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
    command: 'node server/dist/server.js',
    env: { NODE_ENV: 'production' },
    url: 'http://localhost:4124/api/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    cwd: '..',
  },
})
