/** Divination flow state management (Pinia Store) — facade composing deck + reading + flow */

import { defineStore } from 'pinia'
import type { DrawnResult } from '../core/api/types'
import { createDeckState } from './deck'
import { createReadingState } from './reading'
import { createFlowState } from './flow'

export type { DivinationPhase } from './flow'

export const useTarotStore = defineStore('tarot', () => {
  const deck = createDeckState()
  const reading = createReadingState()
  const flow = createFlowState(reading)

  /**
   * Externally-owned write path for the drawn cards. The reading
   * orchestrator calls this after a successful `/api/v1/divinations`
   * response; the deck and tarot stores no longer perform any local
   * shuffling or drawing.
   */
  function setDrawnCards(drawn: DrawnResult[]) {
    flow.drawnCards.value = drawn
  }

  return {
    // Flow
    phase: flow.phase,
    drawnCards: flow.drawnCards,
    currentQuestion: flow.currentQuestion,
    isAnimating: flow.isAnimating,
    isIdle: flow.isIdle,
    isResultVisible: flow.isResultVisible,

    // Deck
    allCards: deck.allCards,
    isCardsLoading: deck.isCardsLoading,
    cardsLoadError: deck.cardsLoadError,
    loadCards: deck.loadCards,

    // Reading
    isReadingLoading: reading.isReadingLoading,
    readingResult: reading.readingResult,
    readingError: reading.readingError,
    waitForReadingResult: reading.waitForReadingResult,
    getReadingResult: () => reading.readingResult.value,

    // Actions
    startDivination: flow.startDivination,
    setPhase: flow.setPhase,
    revealResult: flow.revealResult,
    enterDecision: flow.enterDecision,
    setDrawnCards,
    reset: flow.reset,
  }
})
