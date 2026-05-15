// @vitest-environment node

/**
 * Reading orchestrator unit tests (B2 protocol).
 * After the protocol merge the provider returns a `Divination`
 * (`{ spreadKind, drawn, reading }`); the orchestrator splits this into
 * `drawnRef` (drawn cards) and `resultRef` (reading). These tests cover
 * the happy path, error path, reset semantics and the early-return when a
 * result already exists.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createReadingOrchestrator } from '../src/core/utils/reading/reading_orchestrator'
import type { ReadingProvider } from '../src/core/utils/reading/reading_provider'
import type { DrawnResult, ReadingResult, TarotCardInfo } from '../src/core/api/types'
import type { Divination } from '../src/core/api/divinations'

function makeCard(id: string): TarotCardInfo {
  return {
    id,
    name: id,
    nameEn: id,
    number: 0,
    type: 'major',
    image: `http://localhost/static/${id}.jpeg`,
    upright: { keywords: [], meaning: `${id} upright`, sentiment: 'positive' },
    reversed: { keywords: [], meaning: `${id} reversed`, sentiment: 'negative' },
  }
}

function makeDrawn(id = 'card_a'): DrawnResult[] {
  return [{ card: makeCard(id), position: 'upright' }]
}

function makeReadingResult(): ReadingResult {
  return {
    result: 'positive',
    score: 5,
    cardDetails: [],
  }
}

function makeDivination(drawn: DrawnResult[] = makeDrawn(), reading: ReadingResult = makeReadingResult()): Divination {
  return { spreadKind: 'single_card', drawn, reading }
}

function makeMockProvider(divination: Divination | null = null, shouldReject = false): ReadingProvider {
  return {
    type: 'rule_based',
    requestReading: vi.fn().mockImplementation(() => {
      if (shouldReject) {
        return Promise.reject(new Error('Test error'))
      }
      return Promise.resolve(divination!)
    }),
    isAvailable: vi.fn().mockReturnValue(true),
  }
}

describe('reading_orchestrator', () => {
  let statusRef: ReturnType<typeof ref<'idle' | 'loading' | 'success' | 'error'>>
  let resultRef: ReturnType<typeof ref<ReadingResult | null>>
  let errorRef: ReturnType<typeof ref<string | null>>
  let drawnRef: ReturnType<typeof ref<DrawnResult[]>>

  beforeEach(() => {
    statusRef = ref('idle')
    resultRef = ref(null)
    errorRef = ref(null)
    drawnRef = ref([])
  })

  describe('state', () => {
    it('reflects initial idle state', () => {
      const provider = makeMockProvider()
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      expect(orchestrator.state.status).toBe('idle')
      expect(orchestrator.state.isLoading).toBe(false)
      expect(orchestrator.state.canRetry).toBe(false)
    })

    it('reflects loading state', async () => {
      const provider = makeMockProvider(makeDivination())
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      const promise = orchestrator.start({ spreadKind: 'single_card' })

      expect(orchestrator.state.status).toBe('loading')
      expect(orchestrator.state.isLoading).toBe(true)

      await promise
    })

    it('reflects success state and populates drawnRef + resultRef', async () => {
      const drawn = makeDrawn('the_fool')
      const reading = makeReadingResult()
      const provider = makeMockProvider(makeDivination(drawn, reading))
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ spreadKind: 'single_card' })

      expect(orchestrator.state.status).toBe('success')
      expect(orchestrator.state.result).toStrictEqual(reading)
      expect(orchestrator.state.isLoading).toBe(false)
      // Orchestrator must also write drawn cards into the drawnRef so the
      // overlay reveal animation can read them without a second round-trip.
      expect(drawnRef.value).toStrictEqual(drawn)
      expect(resultRef.value).toStrictEqual(reading)
    })

    it('reflects error state', async () => {
      const provider = makeMockProvider(null, true)
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ spreadKind: 'single_card' })

      expect(orchestrator.state.status).toBe('error')
      expect(orchestrator.state.canRetry).toBe(true)
      expect(orchestrator.state.error).toBeDefined()
      // drawnRef must remain untouched on failure.
      expect(drawnRef.value).toStrictEqual([])
    })
  })

  describe('reset', () => {
    it('clears all state', async () => {
      const provider = makeMockProvider(makeDivination())
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ spreadKind: 'single_card' })
      orchestrator.reset()

      expect(orchestrator.state.status).toBe('idle')
      expect(orchestrator.state.result).toBeNull()
      expect(orchestrator.state.error).toBeNull()
    })
  })

  describe('start with existing result', () => {
    it('returns existing result without calling provider', async () => {
      const existingResult = makeReadingResult()
      resultRef.value = existingResult

      const provider = makeMockProvider()
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        drawnRef,
        errorMessage: 'Default error',
      })

      const result = await orchestrator.start({ spreadKind: 'single_card' })

      expect(result).toStrictEqual(existingResult)
      expect(provider.requestReading).not.toHaveBeenCalled()
      expect(orchestrator.state.status).toBe('success')
    })
  })
})
