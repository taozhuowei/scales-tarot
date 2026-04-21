// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createReadingOrchestrator } from '../app/src/utils/reading/reading_orchestrator'
import type { ReadingProvider } from '../app/src/utils/reading/reading_provider'
import type { ReadingResult } from '../app/src/utils/tarotReading'

function makeMockProvider(result: ReadingResult | null = null, shouldReject = false): ReadingProvider {
  return {
    type: 'offline',
    requestReading: vi.fn().mockImplementation(() => {
      if (shouldReject) {
        return Promise.reject(new Error('Test error'))
      }
      return Promise.resolve(result!)
    }),
    isAvailable: vi.fn().mockReturnValue(true),
  }
}

function makeReadingResult(): ReadingResult {
  return {
    result: 'positive',
    score: 5,
    cardDetails: [],
  }
}

describe('reading_orchestrator', () => {
  let statusRef: ReturnType<typeof ref<'idle' | 'loading' | 'success' | 'error'>>
  let resultRef: ReturnType<typeof ref<ReadingResult | null>>
  let errorRef: ReturnType<typeof ref<string | null>>

  beforeEach(() => {
    statusRef = ref('idle')
    resultRef = ref(null)
    errorRef = ref(null)
  })

  describe('state', () => {
    it('reflects initial idle state', () => {
      const provider = makeMockProvider()
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        errorMessage: 'Default error',
      })

      expect(orchestrator.state.status).toBe('idle')
      expect(orchestrator.state.isLoading).toBe(false)
      expect(orchestrator.state.canRetry).toBe(false)
    })

    it('reflects loading state', async () => {
      const provider = makeMockProvider(makeReadingResult())
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        errorMessage: 'Default error',
      })

      const promise = orchestrator.start({ cards: [], spreadKind: 'three_card' })

      expect(orchestrator.state.status).toBe('loading')
      expect(orchestrator.state.isLoading).toBe(true)

      await promise
    })

    it('reflects success state', async () => {
      const result = makeReadingResult()
      const provider = makeMockProvider(result)
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ cards: [], spreadKind: 'three_card' })

      expect(orchestrator.state.status).toBe('success')
      expect(orchestrator.state.result).toStrictEqual(result)
      expect(orchestrator.state.isLoading).toBe(false)
    })

    it('reflects error state', async () => {
      const provider = makeMockProvider(null, true)
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ cards: [], spreadKind: 'three_card' })

      expect(orchestrator.state.status).toBe('error')
      expect(orchestrator.state.canRetry).toBe(true)
      expect(orchestrator.state.error).toBeDefined()
    })
  })

  describe('reset', () => {
    it('clears all state', async () => {
      const result = makeReadingResult()
      const provider = makeMockProvider(result)
      const orchestrator = createReadingOrchestrator({
        provider,
        statusRef,
        resultRef,
        errorRef,
        errorMessage: 'Default error',
      })

      await orchestrator.start({ cards: [], spreadKind: 'three_card' })
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
        errorMessage: 'Default error',
      })

      const result = await orchestrator.start({ cards: [], spreadKind: 'three_card' })

      expect(result).toStrictEqual(existingResult)
      expect(provider.requestReading).not.toHaveBeenCalled()
      expect(orchestrator.state.status).toBe('success')
    })
  })
})
