/**
 * Cards API
 * Fetches all 78 tarot cards from the backend. The server returns
 * origin-relative image paths; we wrap them with API_BASE so both H5 and
 * mini-program consumers receive URLs they can load directly.
 */

import { request, resolveAssetUrl } from './client'
import type { TarotCardInfo } from './types'

interface CardsResponse {
  cards: TarotCardInfo[]
}

export async function fetchAllCards(): Promise<TarotCardInfo[]> {
  const res = await request<CardsResponse>('/api/v1/cards')
  return res.cards.map(card => ({ ...card, image: resolveAssetUrl(card.image) }))
}
