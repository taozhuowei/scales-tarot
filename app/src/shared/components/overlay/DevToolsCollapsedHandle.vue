<template>
  <!--
    Pure visual surface for the collapsed dev-tools handle (40 px circle).
    All gesture / drag wiring stays on the parent's `.dev-tools-handle`
    element — this component only renders the icon shown when the panel
    is collapsed. We keep markup ultra-thin so the parent owns interaction
    state in one place (drag suppression, click-vs-drag arbitration).
  -->
  <text class="dev-tools-handle__icon" aria-hidden="true">⚡</text>
</template>

<script setup lang="ts">
/**
 * Name: DevToolsCollapsedHandle
 * Purpose: render the lightning-bolt icon shown inside the 40px circular
 *          handle when the DevToolsPanel is in its collapsed state.
 * Reason: extracted from DevToolsPanel.vue (P3 nit fix — file was 382
 *          lines, capped at 300). Splitting the handle's collapsed-state
 *          visuals out keeps the parent template focused on layout +
 *          drag wiring.
 * Data flow: stateless visual; the parent toggles between this child and
 *          the expanded title via `v-if`.
 */
</script>

<style scoped>
.dev-tools-handle__icon {
  font-size: 22px;
  line-height: 1;
  color: var(--color-text-primary);
}
</style>
