<template>
  <!--
    HeaderArea — shell container introduced in task 8.3.1.
    Purpose: physically guarantee that the top-of-page header slot occupies
    the same box geometry across views (idle ↔ divination ↔ fallback) so
    swapping content does not cause y-position jumps.

    All sizing / positioning / safe-area / clearance properties live on this
    shell. Content components (TitleContent, ProgressContent) render only
    their inner visual payload via <slot /> and must not declare any
    positioning, margin, padding, or layout property.

    Notes for callers:
      - role / aria-* attributes flow through Vue's single-root attribute
        inheritance, so each view stamps its own semantics
        (`role="banner"`, `role="progressbar"`, etc.).
      - Animation transforms applied by the parent (e.g. divination's
        GSAP slide-in via animationController.headerStyle) also flow
        through `:style` attribute inheritance and are layered on top of
        the shell's static layout — they are runtime motion, not layout.
  -->
  <view class="header-area">
    <slot />
  </view>
</template>

<script setup lang="ts">
/**
 * Name: HeaderArea container
 * Purpose: shared shell for the top header slot, owning all geometry so
 *          the idle title and divination progress bar render at byte-level
 *          identical positions. See task 8.3.1.
 * Reason: previously TitleArea and ProgressArea each duplicated their own
 *         margin-top / height / padding rules. Drift between them caused
 *         visible y-jumps when swapping views. Centralising the chrome here
 *         removes that drift by construction.
 * Data flow: pure layout shell — receives only attribute pass-through
 *            (role, aria-*, optional style for entry animation). The
 *            slotted content drives the visual payload.
 */
</script>

<style scoped>
.header-area {
  /* Header top inset.
   *
   * Baseline 32px applies to every platform — that is the visual breathing
   * room that pulled the title/progress block away from the safe-area
   * boundary in 8.3.2 and works as-is on H5/desktop.
   *
   * On mp-weixin the WeChat capsule (settings + close pill) floats over
   * the page at roughly `top + height + 8 ≈ 95px` on tall iPhones, smaller
   * on Android. `--menu-clearance` is published by `useCssVarBridge` from
   * `getMenuClearancePx()`: 0 on H5, the live capsule bottom + 8px buffer
   * on mp-weixin. The `max()` therefore:
   *   - on H5         → max(32, 0)  = 32px (legacy behaviour preserved)
   *   - on mp-weixin  → max(32, 95) ≈ 95px (real avoidance, no overlap)
   *
   * This keeps the single CSS rule platform-aware without any #ifdef in
   * Vue templates. The fallback `0px` on `var()` covers the (impossible
   * outside dev) case where the bridge has not mounted yet. (task 8.2.5;
   * supersedes the hard-coded 32px decision from 8.3.2.) */
  margin-top: max(32px, var(--menu-clearance, 0px));

  /* Fixed slot height shared by every header variant. The proportional
     scale system binds `--header-height` on the main page root so this
     scales with viewport without the shell subscribing to
     useResponsiveScale directly. */
  height: var(--header-height);
  flex-shrink: 0;

  /* Layout for the slotted content. Horizontal centring is universal
     (both icon rows and title stacks centre on the cross axis). Vertical
     anchoring is variant-specific and lives on the content components:
     TitleContent anchors its first line at the same y as ProgressContent's
     icon top via inner padding, so the two variants share a baseline
     without the shell biasing one over the other. */
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;

  /* Do not clip — title's guidance line can extend a few px into the
     stage breathing area (legacy behaviour preserved). */
  overflow: visible;

  /* Stack above stage content so the slide-in animation renders cleanly
     above any deck shadow that bleeds into the header band. Mirrors the
     legacy ProgressArea z-index. */
  z-index: 20;
}
</style>
