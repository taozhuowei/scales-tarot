<template>
  <!--
    ReadingTextContainer — phase-2.2.b implementation.
    Hosts the typewriter-rendered per-card meaning texts per PRD §2.4 #7 /
    §7.5.3. Emits `typewriterComplete` after all text animations finish so the
    application phase can advance from `reading` to `decision` (PRD §8.2).
  -->
  <view
    v-if="readingResult"
    class="reading-text-container"
    role="region"
    aria-label="解读文字"
    aria-live="polite"
  >
    <view
      v-for="(detail, index) in viewModel.cardDetails"
      :key="`meaning-${detail.card.id}-${index}`"
      class="reading-text-item"
    >
      <TypewriterText
        class="meaning-text text-base"
        :text="detail.meaning"
        :start-delay="detail.meaningTiming.startDelay"
        :char-interval="detail.meaningTiming.charInterval"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: ReadingTextContainer
 * Purpose: child of ReadingPanel; plays the typewriter animation over the
 *          per-card meanings and signals completion so the application
 *          phase can advance to `decision` (PRD §2.6.3 / §8.2.1 #2).
 * Reason: isolating the typewriter into one container keeps timing logic
 *         local; the parent (ReadingPanel / main page) only needs to listen
 *         for the `typewriterComplete` event, not track individual fields.
 * Data flow: ReadingPanel passes `readingResult`; this container derives
 *           cardDetails + meaningTiming from useReadingPanelController, then
 *           uses a setTimeout to emit `typewriterComplete` once the last
 *           card's meaning text finishes rendering.
 */
import { onMounted, onUnmounted } from 'vue'
import { useReadingPanelController } from '../../composables/use_reading_panel_controller'
import { prefersReducedMotion } from '../../utils/accessibility'
import TypewriterText from '../TypewriterText.vue'
import type { ReadingResult } from '../../api/types'

const props = defineProps<{
  readingResult: ReadingResult | null
}>()

const emit = defineEmits<{
  (event: 'typewriterComplete'): void
}>()

// Non-null assertion: parent (ReadingPanel) gates this component's render
// with v-else-if="readingResult !== null", so readingResult is guaranteed
// non-null when this component is mounted.
const viewModel = useReadingPanelController({
  get readingResult() { return props.readingResult! },
})

let completionTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!props.readingResult) {
    emit('typewriterComplete')
    return
  }

  // When prefers-reduced-motion is active, TypewriterText renders all text
  // synchronously. Advance the phase in the next tick instead of waiting
  // for the full animation duration.
  if (prefersReducedMotion()) {
    completionTimer = setTimeout(() => emit('typewriterComplete'), 0)
    return
  }

  const lastDetail = viewModel.cardDetails.at(-1)
  if (!lastDetail) {
    emit('typewriterComplete')
    return
  }

  // Last character is shown at startDelay + (length - 1) * charInterval.
  // A 50ms buffer ensures the signal fires after TypewriterText fully commits
  // the final character, avoiding race conditions on slow devices.
  const totalMs =
    lastDetail.meaningTiming.startDelay +
    Math.max(0, lastDetail.meaning.length - 1) * lastDetail.meaningTiming.charInterval +
    50

  completionTimer = setTimeout(() => {
    emit('typewriterComplete')
  }, totalMs)
})

onUnmounted(() => {
  if (completionTimer !== null) {
    clearTimeout(completionTimer)
    completionTimer = null
  }
})
</script>

<style scoped>
.reading-text-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.reading-text-item {
  display: flex;
  flex-direction: column;
}

.meaning-text {
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-top: var(--space-2);
}
</style>
