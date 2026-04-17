/**
 * Name: offline_reading_provider
 * Purpose: offline reading provider using the existing backend API.
 * Reason: implements the provider boundary for current HTTP-based readings.
 * Data flow: drawn cards flow in; API response normalized to ReadingResult flows out.
 */

import { fetchReading } from '../../api/readings'
import type { ReadingResult } from '../tarotReading'
import type { ReadingProvider, ReadingRequest } from './reading_provider'

export class OfflineReadingProvider implements ReadingProvider {
  readonly type = 'offline' as const

  async requestReading(request: ReadingRequest): Promise<ReadingResult> {
    return fetchReading(request.cards, request.spreadKind)
  }

  isAvailable(): boolean {
    return true
  }
}
