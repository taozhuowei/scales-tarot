/**
 * Name: reading_provider
 * Purpose: abstract interface for divination request providers.
 * Reason: enables swapping between rule-based and future AI providers
 *         without changing consumers. Now that the backend owns shuffling,
 *         drawing, and interpretation in one transaction, the provider
 *         hands back the full `Divination` (drawn + reading) and clients
 *         no longer feed in cards or a question on the request side.
 * Data flow: spread kind flows in -> hydrated `Divination` flows out.
 */

import type { Divination } from '../../core/api/divinations'
import type { SpreadKind } from '../../core/api/types'

export type ReadingProviderType = 'rule_based' | 'ai'

/**
 * Request parameters for a divination. The spread kind is optional and
 * defaults to `single_card` so existing call sites that pass an empty
 * object keep working.
 */
export interface ReadingRequest {
  spreadKind?: SpreadKind
}

export interface ReadingProvider {
  readonly type: ReadingProviderType
  requestReading(request: ReadingRequest): Promise<Divination>
  isAvailable(): boolean
}

