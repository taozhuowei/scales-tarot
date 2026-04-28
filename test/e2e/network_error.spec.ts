import { test, expect } from '@playwright/test'

/**
 * Verifies the network-failure recovery path: when the reading API returns
 * a 5xx error, the result drawer renders an error state with a retry
 * affordance (instead of leaving the user stuck on the reveal animation).
 *
 * Replaces the old shell script that mutated the backend source file in
 * place. page.route() is the right tool here: it intercepts the request
 * without touching server code or rebuilding.
 */
test('reading API failure surfaces a retryable error UI', async ({ page }) => {
  // Intercept BEFORE navigating so the very first reading request fails.
  await page.route('**/api/v1/readings', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'simulated server error' }),
    })
  })

  await page.goto('/')
  await page.locator('.idle-deck').click()

  // The error state lives inside the drawer; on mobile the drawer may be
  // collapsed, so we assert that the error UI is *attached* to the DOM
  // rather than visible. Either the .error-box element or the explicit
  // retry button is sufficient evidence that the failure path was taken.
  const errorIndicator = page
    .locator('.error-box')
    .or(page.getByRole('button', { name: '重试' }))
    .or(page.getByText('重试读取'))

  await expect(errorIndicator.first()).toBeAttached({ timeout: 30_000 })
})
