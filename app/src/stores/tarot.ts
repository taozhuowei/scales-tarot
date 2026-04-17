/**
 * Divination flow state management (Pinia Store)
 * Manages the full deck (loaded from API), current question, drawn cards, reading result, and flow phases.
 * Card drawing (random selection) happens client-side; interpretation (scoring) is done by backend API.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { drawCards as drawCardsUtil, type DrawnResult, type ReadingResult, type TarotCardInfo } from '../utils/tarotReading'
import { getSpreadCardCount, type SpreadKind } from '../core/layout/spread_registry'

// Spread kind is fixed to single_card. Extension point: make this reactive when
// multi-spread selection UI is reintroduced.
const ACTIVE_SPREAD_KIND: SpreadKind = 'single_card'

import { fetchAllCards } from '../api/cards'
import { fetchReading } from '../api/readings'

// Divination flow phases
export type DivinationPhase = 'idle' | 'shuffling' | 'cutting' | 'drawing' | 'revealing' | 'result'

export const useTarotStore = defineStore('tarot', () => {
  const phase = ref<DivinationPhase>('idle')
  const drawnCards = ref<DrawnResult[]>([])
  const readingResult = ref<ReadingResult | null>(null)
  const allCards = ref<TarotCardInfo[]>([])      // loaded from GET /api/v1/cards
  const currentQuestion = ref('')
  const isCardsLoading = ref(false)
  const cardsLoadError = ref<string | null>(null)
  const isReadingLoading = ref(false)
  const readingError = ref<string | null>(null)

  // Spread kind is fixed; use computed for extensibility when multi-spread is reintroduced
  const spreadKind = computed<SpreadKind>(() => ACTIVE_SPREAD_KIND)
  const cardCount = computed(() => getSpreadCardCount(spreadKind.value))

  // Track the current reading request to guard against stale responses
  const currentReadingRequestId = ref<number>(0)
  let pendingReadingPromise: Promise<ReadingResult | null> | null = null

  const isIdle = computed(() => phase.value === 'idle')
  const isAnimating = computed(() => ['shuffling', 'cutting', 'drawing', 'revealing'].includes(phase.value))
  const isResultVisible = computed(() => phase.value === 'result' && readingResult.value !== null)

  function invalidateReadingRequest() {
    currentReadingRequestId.value += 1
    pendingReadingPromise = null
    isReadingLoading.value = false
  }

  /** Call once at app startup to load all 78 cards from backend */
  async function loadCards(): Promise<void> {
    cardsLoadError.value = null
    if (allCards.value.length > 0 || isCardsLoading.value) return
    isCardsLoading.value = true
    try {
      allCards.value = await fetchAllCards()
    } catch (err) {
      cardsLoadError.value = err instanceof Error ? err.message : 'Failed to load card data'
    } finally {
      isCardsLoading.value = false
    }
  }

  function startDivination(question: string) {
    currentQuestion.value = question
    phase.value = 'shuffling'
    drawnCards.value = []
    readingResult.value = null
    readingError.value = null
    invalidateReadingRequest()
  }

  function setPhase(nextPhase: DivinationPhase) {
    phase.value = nextPhase
  }

  function revealResult() {
    phase.value = 'result'
  }

  /**
   * Synchronous local draw: randomly select cards from the deck.
   * This is immediate and suitable for triggering animations.
   * Use startReadingRequest() to fetch the interpretation separately.
   */
  function drawCards(): DrawnResult[] {
    invalidateReadingRequest()
    const drawn = drawCardsUtil(allCards.value, cardCount.value)
    drawnCards.value = drawn
    readingResult.value = null
    readingError.value = null
    return drawn
  }

  /**
   * Start the async reading request. Returns a promise that resolves when
   * the reading result arrives. Stale responses (from previous draws/resets)
   * are automatically ignored and will not update the store.
   * 
   * The caller can await this or let it resolve in the background.
   */
  async function startReadingRequest(): Promise<ReadingResult | null> {
    if (pendingReadingPromise) {
      return pendingReadingPromise
    }

    const drawn = drawnCards.value
    if (drawn.length === 0) {
      return null
    }

    const requestId = ++currentReadingRequestId.value
    isReadingLoading.value = true
    readingError.value = null

    pendingReadingPromise = (async () => {
      const result = await fetchReading(drawn, spreadKind.value)

      if (requestId !== currentReadingRequestId.value) {
        return null
      }

      readingResult.value = result
      return result
    })()
      .catch((err: unknown) => {
        if (requestId !== currentReadingRequestId.value) {
          return null
        }

        readingError.value = err instanceof Error ? err.message : 'Failed to load reading'
        throw err
      })
      .finally(() => {
        if (requestId === currentReadingRequestId.value) {
          isReadingLoading.value = false
          pendingReadingPromise = null
        }
      })

    return pendingReadingPromise
  }

  function waitForReadingResult(): Promise<ReadingResult | null> {
    if (pendingReadingPromise) {
      return pendingReadingPromise
    }

    return Promise.resolve(readingResult.value)
  }

  /**
   * Legacy combined draw + reading method.
   * Kept for backward compatibility with existing callers.
   * Internally splits into sync draw + async reading.
   */
  async function drawCardsAndFetchReading(): Promise<DrawnResult[]> {
    const drawn = drawCards()
    startReadingRequest().catch(() => {
      // Keep the legacy helper non-throwing for existing callers.
    })
    return drawn
  }

  function getReadingResult(): ReadingResult | null {
    return readingResult.value
  }

  function reset() {
    phase.value = 'idle'
    drawnCards.value = []
    readingResult.value = null
    currentQuestion.value = ''
    readingError.value = null
    invalidateReadingRequest()
  }

  return {
    phase,
    drawnCards,
    allCards,
    currentQuestion,
    spreadKind,
    cardCount,
    isAnimating,
    isIdle,
    isResultVisible,
    isReadingLoading,
    readingResult,
    readingError,
    isCardsLoading,
    cardsLoadError,
    loadCards,
    startDivination,
    setPhase,
    revealResult,
    drawCards,
    startReadingRequest,
    waitForReadingResult,
    drawCardsAndFetchReading,
    getReadingResult,
    reset
  }
})
