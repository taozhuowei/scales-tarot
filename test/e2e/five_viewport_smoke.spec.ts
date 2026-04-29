import { test, expect } from '@playwright/test'

/**
 * G2 acceptance gate — five-viewport visual smoke.
 *
 * Walks the home → divination → reading-panel flow at five viewport sizes
 * (320×568 to 1280×800) and captures `home-{tag}.png` + `result-{tag}.png`
 * for every size. Asserts the layout solver wired the right physical
 * px values into the runtime CSS variables and that the drawer / cards
 * are inside the viewport.
 *
 * Why a separate spec from divination_flow.spec.ts:
 *   • That spec is iPhone 13-only (per the project's PRD targeting H5
 *     mobile). This file widens the coverage to the breakpoints touched
 *     by the new physical-pixel layout solver — including the wide
 *     branch (>=768px) that swaps the bottom sheet for a 480px right
 *     drawer.
 *   • The screenshots stay under test/test-results/ as the visual
 *     evidence trail; we deliberately do NOT diff against baselines yet
 *     — baselines should be set after a design pass, not now.
 */

const VIEWPORTS = [
  { tag: '320x568', width: 320, height: 568, isWide: false },
  { tag: '375x667', width: 375, height: 667, isWide: false },
  { tag: '414x896', width: 414, height: 896, isWide: false },
  { tag: '768x1024', width: 768, height: 1024, isWide: true },
  { tag: '1280x800', width: 1280, height: 800, isWide: true },
] as const

// Layout-solver constants we expect to read back from CSS vars on wide.
const DRAWER_WIDE_WIDTH_PX = 480
// Minimum drawer initial height on narrow viewports (DEFAULT_DRAWER_MIN_INITIAL_HEIGHT
// in app/src/core/sizing/physical_reservations.ts). Acts as a hard lower bound
// for narrow drawer initialHeight.
const DRAWER_MIN_INITIAL_HEIGHT_PX = 220

for (const vp of VIEWPORTS) {
  test(`five-viewport smoke @ ${vp.tag}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    // ----- Home ------------------------------------------------------------
    await page.goto('/')
    await expect(page.locator('.title')).toContainText('Scales Tarot', { timeout: 10_000 })
    await expect(page.locator('.idle-deck')).toBeVisible()
    await page.screenshot({
      path: `test-results/five-viewport/home-${vp.tag}.png`,
      fullPage: false,
    })

    // ----- Trigger divination ---------------------------------------------
    await page.locator('.idle-deck').click()
    await expect(page.locator('.phase-step-icon').first()).toBeVisible({ timeout: 5_000 })

    // ----- Wait for the result panel --------------------------------------
    // 30s budget covers entry + shuffle + cut + draw + reveal + rule-based
    // reading lookup, the same envelope divination_flow.spec.ts uses.
    await expect(page.locator('.reading-panel')).toBeAttached({ timeout: 30_000 })
    // Wait until the reading hero text is actually painted — toBeAttached only
    // proves the node is in the DOM tree, but the reveal/lift animation can
    // still be running with the surface invisible. We screenshot only after
    // the hero copy is on screen so the captured frame matches what users see.
    await expect(page.locator('.reading-panel .hero-title')).toBeVisible({ timeout: 10_000 })
    // Buffer for the lift transform + drawer slide-in + result-card image
    // fade-in to settle. The reveal pipeline runs ~2.5–3s of GSAP after
    // the hero text mounts (lift + reveal + drawer slide). Capturing
    // earlier produces frames where the card face is still off-screen or
    // mid-fade, so we wait long enough for the still frame to be stable.
    await page.waitForTimeout(3000)

    // ----- Result screenshot ----------------------------------------------
    await page.screenshot({
      path: `test-results/five-viewport/result-${vp.tag}.png`,
      fullPage: false,
    })

    // ----- DOM/layout assertions ------------------------------------------
    // Drawer container always exists once the result phase is reached.
    const drawerContainer = page.locator('.drawer-container')
    await expect(drawerContainer).toBeAttached()
    const drawerBox = await drawerContainer.boundingBox()
    expect(drawerBox, 'drawer-container must have a bounding box').not.toBeNull()
    if (drawerBox) {
      // Right edge must not exceed viewport. Allow 1px tolerance for
      // sub-pixel layout rounding on Chromium/Linux.
      expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(vp.width + 1)
    }

    // CSS variables: stage-width / drawer-width are inline-bound by
    // use_overlay_controller from the solver. They are written on the
    // overlay root regardless of breakpoint; we read them and assert
    // the physical-pixel solver matches the documented constants.
    const cssVars = await page.evaluate(() => {
      const overlay = document.querySelector('.divination-overlay') as HTMLElement | null
      if (!overlay) return { stage: '', drawer: '' }
      return {
        stage: overlay.style.getPropertyValue('--stage-width').trim(),
        drawer: overlay.style.getPropertyValue('--drawer-width').trim(),
      }
    })

    if (vp.isWide) {
      expect(cssVars.stage, `--stage-width should be a px value at ${vp.tag}`).toMatch(/^\d+px$/)
      expect(cssVars.drawer, `--drawer-width should be a px value at ${vp.tag}`).toMatch(/^\d+px$/)
      const stagePx = parseInt(cssVars.stage, 10)
      const drawerPx = parseInt(cssVars.drawer, 10)
      // Wide layout: drawer is the fixed 480 px right panel and stage is
      // viewport.width - drawerWideWidth.
      expect(drawerPx).toBe(DRAWER_WIDE_WIDTH_PX)
      expect(stagePx).toBe(vp.width - DRAWER_WIDE_WIDTH_PX)
    } else {
      // Narrow: stage is full-width, drawer width is the full viewport.
      // initialHeight = viewport.height - cardBottomScreenY + drawerCardOverlap;
      // we lower-bound it by DRAWER_MIN_INITIAL_HEIGHT_PX which the solver
      // budgets for explicitly.
      const drawerSheet = page.locator('.drawer-sheet')
      await expect(drawerSheet).toBeVisible()
      const sheetBox = await drawerSheet.boundingBox()
      expect(sheetBox).not.toBeNull()
      if (sheetBox) {
        expect(
          sheetBox.height,
          `narrow drawer initialHeight must be >= ${DRAWER_MIN_INITIAL_HEIGHT_PX}px at ${vp.tag}`,
        ).toBeGreaterThanOrEqual(DRAWER_MIN_INITIAL_HEIGHT_PX)
      }
    }
  })
}
