import { test, expect } from '@playwright/test'

/**
 * Happy path: home page → divination overlay → result panel.
 *
 * The flow auto-progresses through shuffle/cut/draw/reveal once the user
 * taps the idle deck (per PRD §6.3 "占卜流程应自动推进"). The 30-second
 * timeout on the reading-panel assertion covers the full animation
 * pipeline plus the rule-based reading lookup.
 *
 * Note: we deliberately do NOT click "回到首页" here. On mobile the action
 * bar is inside a draggable drawer that may be collapsed at this point,
 * which makes click reliability viewport-dependent. Verifying the reading
 * surface and the back-home button is in the DOM is enough to catch the
 * regressions this test is designed to prevent.
 */
test('home → divination → reading panel surfaces', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.title')).toContainText('Scales Tarot')
  await expect(page.locator('.idle-deck')).toBeVisible()
  await expect(page.locator('.touch-hint')).toBeVisible()

  await page.locator('.idle-deck').click()

  await expect(page.locator('.phase-step-icon').first()).toBeVisible({ timeout: 5_000 })
  expect(await page.locator('.phase-step-icon').count()).toBeGreaterThanOrEqual(4)

  await expect(page.locator('.reading-panel')).toBeVisible({ timeout: 30_000 })

  // The action bar should be present in the DOM with the back-home affordance,
  // even if collapsed inside the drawer at default height.
  await expect(page.locator('.action-bar')).toBeAttached()
  await expect(page.getByRole('button', { name: '回到首页' })).toBeAttached()
})
