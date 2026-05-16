/**
 * Name: utils/dev/container_borders
 * Purpose: H5-only debug helper that toggles the `dev-debug-borders` class on
 *          `document.documentElement`, enabling a CSS overlay that draws
 *          colored outlines around major layout containers. Used by the
 *          DevToolsPanel "borders" toggle (tracked under task 8.3.3).
 * Reason: previously inlined inside `pages/main/index.vue`, where it forced
 *         three `// eslint-disable-next-line no-restricted-globals / no-undef`
 *         comments around `document.documentElement` access. Extracting the
 *         logic into a dedicated H5-only utility lets the eslint-disable be
 *         declared once at module scope with a justified `-- reason:` block,
 *         and keeps the page component free of platform-conditional plumbing.
 *         Mirrors the pattern used by `utils/accessibility.ts::prefersReducedMotion`.
 *
 * Platform behavior:
 *   - H5: toggles the body-level CSS class so global selectors can apply
 *     dashed-outline rules to debug containers.
 *   - mp-weixin: the function body's DOM access is compiled out by uniapp's
 *     `#ifdef H5` conditional-compilation directive, leaving a no-op
 *     early-return. The defensive
 *     `typeof document === 'undefined'` guard is belt-and-suspenders so the
 *     module remains safe even if the conditional compilation step is
 *     bypassed (e.g. during unit tests that import the file directly).
 */

const DEBUG_BORDERS_CLASS = 'dev-debug-borders'

/**
 * Apply or remove the global debug-border CSS class. Caller owns the boolean
 * state (typically a Vue ref in DevToolsPanel) — this helper only mirrors
 * that state into the DOM.
 *
 * @param enabled — when true, adds the debug class; when false, removes it.
 */
export function toggleContainerBorders(enabled: boolean): void {
  // #ifdef H5
  /* eslint-disable no-restricted-globals -- reason: H5-only debug helper; document access is gated by uniapp #ifdef H5 and a runtime typeof guard, so mp-weixin builds never reach this branch. */
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (enabled) {
    root.classList.add(DEBUG_BORDERS_CLASS)
  } else {
    root.classList.remove(DEBUG_BORDERS_CLASS)
  }
  /* eslint-enable no-restricted-globals */
  // #endif
}
