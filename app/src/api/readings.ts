/**
 * Readings API
 * Submits drawn card IDs + positions to the backend and returns the interpretation.
 * Scoring logic lives entirely on the server; only card IDs and positions are sent.
 */

import { request } from './client'
import type { DrawnResult, ReadingResult } from '../utils/tarotReading'

interface ReadingRequestCard {
  cardId: string
  position: 'upright' | 'reversed'
}

export function fetchReading(drawn: DrawnResult[], spreadKind: string): Promise<ReadingResult> {
  const cards: ReadingRequestCard[] = drawn.map(d => ({
    cardId: d.card.id,
    position: d.position
  }))
  return request<ReadingResult>('/api/v1/readings', { method: 'POST', data: { cards, spreadKind } })
}
