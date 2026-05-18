<template>
  <!--
    Boot shell — the app's single uni-app route (docs/prd/glossary.md（路由）).
    Bootstrap outcome (App.vue → boot store) decides which mutually-
    exclusive surface mounts: a critical-failure → the FallbackView; pending
    or success → the MainSurface. There is no second route + reLaunch — the
    fallback is a view-level switch, and recovery is reactive (status flips
    back to a non-failed value → MainSurface re-mounts automatically).
    The fallback branch carries the full-viewport flex column wrapper
    (FallbackView itself is flex:1); MainSurface owns its own root.
  -->
  <view v-if="isFailed" class="fallback-route">
    <FallbackView />
  </view>
  <MainSurface v-else />
</template>

<script setup lang="ts">
/**
 * Name: pages/index
 * Purpose: the route root. A pure boot shell: reads the bootstrap outcome
 *          via useBootStatus and renders the FallbackView on a critical
 *          failure, otherwise the MainSurface. No orchestration lives here
 *          — useMainStage is constructed inside MainSurface, so it is never
 *          instantiated in the failed state.
 * Data flow: useBootStatus().isFailed (← boot store ← App.vue.bootstrap)
 *           ──▶ v-if branch.
 */
import FallbackView from '../flows/fallback/components/FallbackView.vue'
import MainSurface from '../flows/index/components/MainSurface.vue'
import { useBootStatus } from '../core/composables/use_boot_status'

const { isFailed } = useBootStatus()
</script>

<style scoped>
.fallback-route {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
