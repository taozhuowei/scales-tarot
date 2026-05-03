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
  /* MP-WeChat clearance: push the header below the menu capsule (~87px
     from viewport top on tall iPhones; safe-area-top + page padding only
     reach ~63px). 32px margin sits the header below the capsule with a
     small breathing buffer. H5 has no menu button — same value keeps
     the two platforms visually aligned. Keep this single source of truth
     for the entire app. (Decision: task 8.3.2.) */
  margin-top: 32px;

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
