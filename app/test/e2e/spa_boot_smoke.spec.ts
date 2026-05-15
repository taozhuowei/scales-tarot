import { test, expect } from '@playwright/test'

/**
 * Smoke gate for SPA boot. Catches three classes of regressions that the
 * unit / integration test suites cannot see because they don't run in a
 * real browser:
 *
 *   1. `console.error` from the running app (uncaught Vue warnings,
 *      missing globals, third-party script blow-ups).
 *   2. Network responses with status >= 400 — broken /static asset paths,
 *      404'd manifests, dev-server URL leaks reaching prod, etc. The
 *      navigation to "/" itself should never trigger a backend mutation,
 *      so any 4xx/5xx during boot is a bug.
 *   3. CSP violations (`securitypolicyviolation` events) — the prod CSP
 *      is strict ('self' only). A missed inline script or a stray CDN
 *      reference would fail silently in dev (loopback origins are allow-
 *      listed) and only surface in production. We capture violations
 *      via a page-side event listener installed before navigation.
 *
 * The test only asserts on boot — it does NOT click into the divination
 * flow. That flow has its own coverage in divination_flow.spec.ts and
 * viewport_smoke.spec.ts; mixing concerns here would dilute the signal
 * (e.g. a legitimate offline mode showing a banner with `console.warn`
 * could mask a real CSP issue if we waited for it to settle first).
 */

interface CspViolation {
  violatedDirective: string
  blockedURI: string
}

test('SPA boots without console.error, network 4xx/5xx, or CSP violations', async ({ page }) => {
  const consoleErrors: string[] = []
  const networkFailures: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}`)
  })

  page.on('response', (response) => {
    const status = response.status()
    if (status >= 400) {
      networkFailures.push(`${status} ${response.request().method()} ${response.url()}`)
    }
  })

  // CSP violations are dispatched as `securitypolicyviolation` events on
  // `document`. They do NOT surface as console.error in all Chromium
  // builds, so we install an explicit listener before navigation and
  // hand the captured records back via window.__cspViolations.
  await page.addInitScript(() => {
    interface CspWindow extends Window {
      __cspViolations?: { violatedDirective: string; blockedURI: string }[]
    }
    const w = window as CspWindow
    w.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations!.push({
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
      })
    })
  })

  await page.goto('/')
  // networkidle: wait until there have been no network connections for 500ms.
  // The SPA finishes its initial bundle + font + manifest fetches well within
  // the default 30s nav timeout; if anything keeps trickling in past that,
  // it's already a perf/reliability bug worth surfacing.
  await page.waitForLoadState('networkidle')

  const cspViolations = await page.evaluate<CspViolation[]>(() => {
    interface CspWindow extends Window {
      __cspViolations?: CspViolation[]
    }
    return (window as CspWindow).__cspViolations ?? []
  })

  // Combine console.error + uncaught page errors — both are Vue/runtime
  // failures from the user's perspective.
  const allErrors = [...consoleErrors, ...pageErrors]

  expect(
    allErrors,
    `console.error / pageerror during boot:\n  - ${allErrors.join('\n  - ')}`,
  ).toEqual([])

  expect(
    networkFailures,
    `network responses with status >= 400 during boot:\n  - ${networkFailures.join('\n  - ')}`,
  ).toEqual([])

  expect(
    cspViolations,
    `CSP violations during boot:\n${JSON.stringify(cspViolations, null, 2)}`,
  ).toEqual([])
})
