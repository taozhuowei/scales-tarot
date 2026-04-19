/**
 * Name: reading_orchestrator
 * Purpose: manage reading request lifecycle with retry and state tracking.
 * Reason: decouple reading request orchestration from overlay animation and store.
 * Data flow: reading request triggers flow in; status and results flow out.
 */

import type { Ref } from 'vue'
import type { ReadingResult } from '../tarotReading'
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
  errorMessage: string
}

const TIMEOUT_MS = 15000
const RETRY_BACKOFF_MS = 1000

export function createReadingOrchestrator(deps: ReadingOrchestratorDeps): ReadingOrchestrator {
  const { provider, statusRef, resultRef, errorRef, errorMessage } = deps
  let currentRequest: Promise<ReadingResult | null> | null = null
  let lastRequest: ReadingRequest | null = null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  async function doRequest(request: ReadingRequest, retryCount: number): Promise<ReadingResult | null> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时，请稍后重试')), TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([provider.requestReading(request), timeoutPromise])
      resultRef.value = result
      statusRef.value = 'success'
      return result
    } catch (err: unknown) {
      if (retryCount < 1) {
        await new Promise<void>((resolve) => { setTimeout(resolve, RETRY_BACKOFF_MS) })
        return doRequest(request, retryCount + 1)
      }
      errorRef.value = err instanceof Error ? err.message : errorMessage
      statusRef.value = 'error'
      return null
    }
  }

  async function executeRequest(request: ReadingRequest): Promise<ReadingResult | null> {
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
      if (resultRef.value) {
        statusRef.value = 'success'
        return resultRef.value
      }
      return executeRequest(request)
    },
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


