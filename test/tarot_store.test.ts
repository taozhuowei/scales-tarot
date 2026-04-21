/**
 * Tarot store unit tests
 * Tests the new split draw + reading flow:
 * - Local draw is synchronous
 * - Async reading can be awaited separately
 * - Stale reading results are ignored after reset/new draw
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTarotStore } from '../app/src/stores/tarot'
import type { TarotCardInfo, DrawnResult, ReadingResult } from '../app/src/utils/tarotReading'

// Mock the API modules
const mockFetchReading = vi.hoisted(() => vi.fn())
const mockFetchAllCards = vi.hoisted(() => vi.fn())

vi.mock('../app/src/api/readings', () => ({
  fetchReading: mockFetchReading,
}))

vi.mock('../app/src/api/cards', () => ({
  fetchAllCards: mockFetchAllCards,
}))

// Helper to create minimal valid TarotCardInfo
function makeCard(id: string, sentiment: 'positive' | 'negative' | 'neutral' = 'positive'): TarotCardInfo {
  return {
    id,
    name: id,
    nameEn: id,
    number: 0,
    type: 'major',
    image: `http://localhost:3000/static/themes/golden_dawn/tarot/major/major_arcana_00_${id}.jpeg`,
    upright: { keywords: [], meaning: `${id} upright`, sentiment },
    reversed: { keywords: [], meaning: `${id} reversed`, sentiment: sentiment === 'positive' ? 'negative' : 'positive' }
  }
}

// Helper to create a mock reading result
function makeReadingResult(drawn: DrawnResult[]): ReadingResult {
  return {
    result: 'positive',
    score: 3,
    cardDetails: drawn.map(d => ({
      card: d.card,
      position: d.position,
      meaning: d.position === 'upright' ? d.card.upright.meaning : d.card.reversed.meaning,
    })),
  }
}

const MOCK_DECK: TarotCardInfo[] = Array.from({ length: 10 }, (_, i) => makeCard(`card_${i}`))

describe('tarot store - draw and reading flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetchAllCards.mockResolvedValue(MOCK_DECK)
    mockFetchReading.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('drawCards (synchronous)', () => {
    it('draws correct number of cards synchronously (single_card)', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // Draw should be synchronous and return immediately
      const drawn = store.drawCards()

      expect(drawn).toHaveLength(1)
      expect(store.drawnCards).toHaveLength(1)
      // Use toEqual for deep equality comparison
      expect(store.drawnCards).toEqual(drawn)
    })

    it('does not trigger API call when drawing', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.drawCards()

      // fetchReading should not be called by drawCards
      expect(mockFetchReading).not.toHaveBeenCalled()
    })

    it('each drawn card has a valid position', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      const drawn = store.drawCards()

      drawn.forEach((d: DrawnResult) => {
        expect(['upright', 'reversed']).toContain(d.position)
      })
    })

    it('draws unique cards (no duplicates)', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      const drawn = store.drawCards()
      const ids = drawn.map(d => d.card.id)
      expect(new Set(ids).size).toBe(1)
    })

    it('replaces previous drawn cards on subsequent draws', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.drawCards()
      const firstIds = store.drawnCards.map(c => c.card.id).sort()

      store.drawCards()
      const secondIds = store.drawnCards.map(c => c.card.id).sort()

      // The store should contain 1 card after second draw
      expect(store.drawnCards).toHaveLength(1)
      expect(firstIds).toHaveLength(1)
      // Cards may be the same or different due to randomness, but structure is valid
      secondIds.forEach(id => {
        expect(MOCK_DECK.some(c => c.id === id)).toBe(true)
      })
    })
  })

  describe('startReadingRequest (async)', () => {
    it('fetches reading asynchronously after draw', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      const drawn = store.drawCards()
      const mockResult = makeReadingResult(drawn)
      mockFetchReading.mockResolvedValue(mockResult)

      const result = await store.startReadingRequest()

      expect(mockFetchReading).toHaveBeenCalledTimes(1)
      expect(mockFetchReading).toHaveBeenCalledWith(drawn, store.spreadKind)
      expect(result).toEqual(mockResult)
      expect(store.readingResult).toEqual(mockResult)
    })

    it('returns null if no cards have been drawn', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      const result = await store.startReadingRequest()

      expect(mockFetchReading).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('can be awaited separately from draw', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // Draw synchronously
      const drawn = store.drawCards()

      // Set up delayed reading response
      let resolveReading: (value: ReadingResult) => void
      const readingPromise = new Promise<ReadingResult>((resolve) => {
        resolveReading = resolve
      })
      mockFetchReading.mockReturnValue(readingPromise)

      // Start reading request (don't await yet)
      const requestPromise = store.startReadingRequest()

      // At this point, readingResult should still be null
      expect(store.readingResult).toBeNull()

      // Resolve the reading
      const mockResult = makeReadingResult(drawn)
      resolveReading!(mockResult)

      // Now await the request
      const result = await requestPromise

      expect(result).toEqual(mockResult)
      expect(store.readingResult).toEqual(mockResult)
    })

    it('reading can resolve after animation would complete', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.drawCards()

      // Simulate slow reading API
      const mockResult = makeReadingResult(store.drawnCards)
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResult), 50))
      )

      const startTime = Date.now()
      const result = await store.startReadingRequest()
      const elapsed = Date.now() - startTime

      // Should have waited for the async delay
      expect(elapsed).toBeGreaterThanOrEqual(40)
      expect(result).toEqual(mockResult)
    })
  })

  describe('stale response protection', () => {
    it('ignores stale reading result after reset', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // First draw
      store.drawCards()
      const firstResult = makeReadingResult(store.drawnCards)

      // Set up delayed reading response
      let resolveFirstReading: (value: ReadingResult) => void
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => {
          resolveFirstReading = resolve
        })
      )

      // Start first reading request
      const firstRequestPromise = store.startReadingRequest()

      // Reset before first reading completes
      store.reset()

      // Now resolve the first reading
      resolveFirstReading!(firstResult)

      // Wait for the promise to settle
      const firstResultActual = await firstRequestPromise

      // The stale result should be ignored (function returns null)
      expect(firstResultActual).toBeNull()
      // readingResult should remain null after reset
      expect(store.readingResult).toBeNull()
    })

    it('ignores stale reading result after new draw', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // First draw and start reading
      store.drawCards()
      const firstResult = makeReadingResult(store.drawnCards)

      let resolveFirstReading: (value: ReadingResult) => void
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => {
          resolveFirstReading = resolve
        })
      )

      const firstRequestPromise = store.startReadingRequest()

      // Second draw (this invalidates the first reading request)
      store.drawCards()
      const secondResult = makeReadingResult(store.drawnCards)

      // Resolve first request first - should be ignored
      resolveFirstReading!(firstResult)
      const firstActual = await firstRequestPromise

      expect(firstActual).toBeNull()
      expect(store.readingResult).toBeNull()

      // Now start a new reading request
      mockFetchReading.mockResolvedValue(secondResult)
      const secondResultActual = await store.startReadingRequest()

      expect(secondResultActual).toEqual(secondResult)
      expect(store.readingResult).toEqual(secondResult)
    })

    it('draw invalidates previous reading request via requestId tracking', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // First draw and start reading
      store.drawCards()
      const firstDrawCards = [...store.drawnCards]

      let resolveFirstReading: (value: ReadingResult) => void
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => {
          resolveFirstReading = resolve
        })
      )

      const firstPromise = store.startReadingRequest()

      // Second draw - this should increment requestId, invalidating first request
      store.drawCards()
      const secondDrawCards = [...store.drawnCards]

      // Complete the first API call
      const firstResult = makeReadingResult(firstDrawCards)
      resolveFirstReading!(firstResult)

      // First request should return null due to stale guard
      const firstActual = await firstPromise
      expect(firstActual).toBeNull()

      // Store should not have the first result
      expect(store.readingResult).toBeNull()

      // Now start a second request which should succeed
      const secondResult = makeReadingResult(secondDrawCards)
      mockFetchReading.mockResolvedValue(secondResult)
      const secondActual = await store.startReadingRequest()

      expect(secondActual).toEqual(secondResult)
      expect(store.readingResult).toEqual(secondResult)
    })

    it('multiple concurrent requests only latest result is kept', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // Set up multiple concurrent reading requests
      const resolvers: Array<(value: ReadingResult) => void> = []
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => {
          resolvers.push(resolve)
        })
      )

      // First draw and request
      store.drawCards()
      const firstResult = makeReadingResult(store.drawnCards)
      const firstPromise = store.startReadingRequest()

      // Second draw and request (this should invalidate first)
      store.drawCards()
      const secondResult = makeReadingResult(store.drawnCards)
      const secondPromise = store.startReadingRequest()

      // Resolve first request first
      resolvers[0](firstResult)
      const firstActual = await firstPromise

      // First result should be ignored
      expect(firstActual).toBeNull()
      expect(store.readingResult).toBeNull()

      // Resolve second request
      resolvers[1](secondResult)
      const secondActual = await secondPromise

      // Second result should be kept
      expect(secondActual).toEqual(secondResult)
      expect(store.readingResult).toEqual(secondResult)
    })

    it('reset during in-flight reading invalidates that reading', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.startDivination('Test question')

      store.drawCards()
      const mockResult = makeReadingResult(store.drawnCards)

      let resolveReading: (value: ReadingResult) => void
      mockFetchReading.mockImplementation(() => 
        new Promise(resolve => {
          resolveReading = resolve
        })
      )

      const requestPromise = store.startReadingRequest()

      // Reset the store
      store.reset()

      // Complete the original request
      resolveReading!(mockResult)
      const result = await requestPromise

      // Should return null due to stale request
      expect(result).toBeNull()
      expect(store.readingResult).toBeNull()
      expect(store.phase).toBe('idle')
    })
  })

  describe('phase transitions', () => {
    it('transitions through phases correctly', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      expect(store.phase).toBe('idle')
      expect(store.isIdle).toBe(true)
      expect(store.isAnimating).toBe(false)

      store.startDivination('Test question')
      expect(store.phase).toBe('shuffling')
      expect(store.isIdle).toBe(false)
      expect(store.isAnimating).toBe(true)

      store.setPhase('cutting')
      expect(store.phase).toBe('cutting')

      store.setPhase('drawing')
      expect(store.phase).toBe('drawing')

      store.setPhase('revealing')
      expect(store.phase).toBe('revealing')

      store.revealResult()
      expect(store.phase).toBe('result')
      // isResultVisible is false because readingResult is null (no result loaded yet)
      expect(store.isResultVisible).toBe(false)
    })

    it('isResultVisible requires both phase and readingResult', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      // Initially not visible
      expect(store.isResultVisible).toBe(false)

      // Just changing phase is not enough
      store.setPhase('result')
      expect(store.isResultVisible).toBe(false)

      // Need both phase='result' AND readingResult
      store.drawCards()
      const mockResult = makeReadingResult(store.drawnCards)
      mockFetchReading.mockResolvedValue(mockResult)
      
      await store.startReadingRequest()
      expect(store.isResultVisible).toBe(true)
    })

    it('reset clears all state including phase and reading', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.startDivination('Test question')
      store.drawCards()
      store.setPhase('revealing')
      store.readingResult = makeReadingResult(store.drawnCards)

      store.reset()

      expect(store.phase).toBe('idle')
      expect(store.drawnCards).toHaveLength(0)
      expect(store.readingResult).toBeNull()
      expect(store.currentQuestion).toBe('')
      expect(store.isIdle).toBe(true)
    })
  })

  describe('backward compatibility', () => {
    it('drawCardsAndFetchReading maintains old behavior', async () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK

      store.drawCards()
      const mockResult = makeReadingResult(store.drawnCards)
      mockFetchReading.mockResolvedValue(mockResult)

      // Use the legacy method
      const result = await store.drawCardsAndFetchReading()

      expect(result).toHaveLength(1)
      expect(mockFetchReading).toHaveBeenCalled()
      
      // Wait for the async reading to complete
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(store.readingResult).toEqual(mockResult)
    })
  })

  describe('spreadKind (fixed single_card)', () => {
    it('spreadKind is always single_card', () => {
      const store = useTarotStore()
      expect(store.spreadKind).toBe('single_card')
      expect(store.cardCount).toBe(1)
    })

    it('spreadKind remains single_card after reset', () => {
      const store = useTarotStore()
      store.allCards = MOCK_DECK
      store.startDivination('Test')
      store.drawCards()
      store.reset()
      expect(store.spreadKind).toBe('single_card')
      expect(store.cardCount).toBe(1)
    })
  })
})
