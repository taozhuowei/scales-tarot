/**
 * Name: flow state module
 * Purpose: pure function module managing application-level divination flow
 *          state (phase, question, drawn cards).
 * Reason: separates flow concerns from deck and reading state. The flow
 *         layer now models the application-level 4 stages (idle /
 *         divination / reading / decision) per PRD §2.6; the in-divination
 *         animation phases (shuffling / cutting / drawing / revealing) are
 *         a separate concept tracked by the overlay controller and progress
 *         icons, and are not represented here. Spread metadata (kind, card
 *         count) is no longer owned here; the backend protocol implies
 *         `single_card` for now and consumers that need a count derive it
 *         locally until the layout layer is refactored in the next phase.
 * Data flow: phase transitions and drawn cards flow in (from orchestrator
 *           and animation pipeline); read by overlay components and stores.
 */

import { computed, ref } from 'vue'
import type { DrawnResult } from '../core/api/types'
import type { createReadingState } from './reading'

export type DivinationPhase = 'idle' | 'divination' | 'reading' | 'decision'

export function createFlowState(reading: ReturnType<typeof createReadingState>) {
  const phase = ref<DivinationPhase>('idle')
  const drawnCards = ref<DrawnResult[]>([])
  const currentQuestion = ref('')

  const isIdle = computed(() => phase.value === 'idle')
  const isAnimating = computed(() => phase.value === 'divination')
  // Both reading and decision stages render the result panel (panel stays
  // on screen, only the action area visibility differs). The legacy name
  // `isResultVisible` is preserved here; a naming codemod is scheduled for
  // phase 4 to align it with the new two-layer terminology.
  const isResultVisible = computed(() =>
    (phase.value === 'reading' || phase.value === 'decision') && reading.readingResult.value !== null,
  )

  function startDivination(question: string) {
    currentQuestion.value = question
    phase.value = 'divination'
    drawnCards.value = []
    reading.reset()
  }

  function setPhase(nextPhase: DivinationPhase) {
    phase.value = nextPhase
  }

  function revealResult() {
    phase.value = 'reading'
  }

  /**
   * Promote the application-level stage from `reading` to `decision` so the
   * action area can fade in. Per PRD §2.6.1 / §8.2 stage 3, the reading view
   * calls this when the typewriter animation finishes; until then the action
   * area remains hidden. Wiring of the actual typewriter `onComplete` hook
   * is scheduled for phase 2 of the refactor — this function is exported now
   * so downstream callers can rely on it without further store changes.
   */
  function enterDecision() {
    phase.value = 'decision'
  }

  function reset() {
    phase.value = 'idle'
    drawnCards.value = []
    currentQuestion.value = ''
    reading.reset()
  }

  return {
    phase,
    drawnCards,
    currentQuestion,
    isIdle,
    isAnimating,
    isResultVisible,
    startDivination,
    setPhase,
    revealResult,
    enterDecision,
    reset,
  }
}
