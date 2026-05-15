/**
 * Name: reading_orchestrator
 * Purpose: manage divination request lifecycle with retry and state tracking.
 * Reason: decouple divination orchestration from overlay animation and store.
 *         Backend now returns `{ drawn, reading }` together, so the
 *         orchestrator splits them into the appropriate refs (drawn ->
 *         flow store, reading -> reading store) and exposes only the
 *         reading result to its callers for back-compat with consumers
 *         that just want the interpretation.
 * Data flow: divination request triggers flow in; drawn cards land in
 *           `drawnRef`, reading lands in `resultRef`, and status/error
 *           flow through dedicated refs.
 */

import type { Ref } from 'vue'
import type { DrawnResult, ReadingResult } from '../../core/api/types'
import type { Divination } from '../../core/api/divinations'
import type { ReadingProvider, ReadingRequest } from './reading_provider'

export type ReadingStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ReadingOrchestratorState {
  status: ReadingStatus
  result: ReadingResult | null
  error: string | null
  isLoading: boolean
  canRetry: boolean
}

export interface ReadingOrchestrator {
  state: ReadingOrchestratorState
  start(request: ReadingRequest): Promise<ReadingResult | null>
  retry(request?: ReadingRequest): Promise<ReadingResult | null>
  reset(): void
  destroy(): void
}

export interface ReadingOrchestratorDeps {
  provider: ReadingProvider
  statusRef: Ref<ReadingStatus>
  resultRef: Ref<ReadingResult | null>
  errorRef: Ref<string | null>
  /**
   * Where to write the drawn cards returned by the server. The flow store
   * owns `drawnCards`; the orchestrator writes here directly so reveal
   * animations can read the freshly-drawn cards without a second round-trip.
   */
  drawnRef: Ref<DrawnResult[]>
  errorMessage: string
}

const TIMEOUT_MS = 15000
const RETRY_BACKOFF_MS = 1000

export function createReadingOrchestrator(deps: ReadingOrchestratorDeps): ReadingOrchestrator {
  const { provider, statusRef, resultRef, errorRef, drawnRef, errorMessage } = deps
  let currentRequest: Promise<ReadingResult | null> | null = null
  let lastRequest: ReadingRequest | null = null
  let destroyed = false
  const pendingTimers: ReturnType<typeof setTimeout>[] = []

  function getState(): ReadingOrchestratorState {
    return {
      status: statusRef.value,
      result: resultRef.value,
      error: errorRef.value,
      isLoading: statusRef.value === 'loading',
      canRetry: statusRef.value === 'error',
    }
  }

  function trackTimer(id: ReturnType<typeof setTimeout>): void {
    pendingTimers.push(id)
  }

  function untrackTimer(id: ReturnType<typeof setTimeout>): void {
    const idx = pendingTimers.indexOf(id)
    if (idx >= 0) pendingTimers.splice(idx, 1)
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        untrackTimer(id)
        resolve()
      }, ms)
      trackTimer(id)
    })
  }

  async function doRequest(request: ReadingRequest, retryCount: number): Promise<ReadingResult | null> {
    if (destroyed) return null

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('请求超时，请稍后重试')), TIMEOUT_MS)
    })

    try {
      const divination: Divination = await Promise.race([
        provider.requestReading(request),
        timeoutPromise,
      ])
      if (timeoutId) clearTimeout(timeoutId)
      // If the orchestrator was destroyed mid-request (e.g. user backed out
      // of the overlay), drop the response on the floor instead of leaking
      // it into a now-stale store. Without this, returning to a fresh flow
      // would briefly flash the previous run's cards.
      if (destroyed) return null
      // Drawn cards go to the flow store; reading goes to the reading store.
      // Order matters: write drawn first so any sync watcher on the reading
      // result already finds the drawn cards in place.
      drawnRef.value = divination.drawn
      resultRef.value = divination.reading
      statusRef.value = 'success'
      return divination.reading
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId)
      if (retryCount < 1 && !destroyed) {
        await delay(RETRY_BACKOFF_MS)
        return doRequest(request, retryCount + 1)
      }
      errorRef.value = err instanceof Error ? err.message : errorMessage
      statusRef.value = 'error'
      return null
    }
  }

  async function executeRequest(request: ReadingRequest): Promise<ReadingResult | null> {
    if (destroyed) return null
    if (currentRequest) {
      return currentRequest
    }

    statusRef.value = 'loading'
    errorRef.value = null

    currentRequest = doRequest(request, 0).finally(() => {
      currentRequest = null
    })

    return currentRequest
  }

  return {
    get state() {
      return getState()
    },
    async start(request: ReadingRequest) {
      lastRequest = request
      // If a result already exists, return it without re-requesting.
      // Callers must call reset() first if they want a fresh reading.
      if (resultRef.value) {
        statusRef.value = 'success'
        return resultRef.value
      }
      return executeRequest(request)
    },
    /**
     * Retry semantics changed with the protocol merge: the divinations
     * endpoint now draws + interprets in one transaction. A retry therefore
     * re-draws fresh cards (overwriting drawnRef) and produces a new
     * reading — there is no longer a way to keep the same draw and
     * re-interpret it.
     */
    async retry(request?: ReadingRequest) {
      const requestToUse = request ?? lastRequest
      if (!requestToUse) {
        return null
      }
      errorRef.value = null
      statusRef.value = 'idle'
      return executeRequest(requestToUse)
    },
    reset() {
      statusRef.value = 'idle'
      resultRef.value = null
      errorRef.value = null
      lastRequest = null
      currentRequest = null
    },
    destroy() {
      destroyed = true
      for (const id of pendingTimers) clearTimeout(id)
      pendingTimers.length = 0
      currentRequest = null
    },
  }
}
