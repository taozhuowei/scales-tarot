/**
 * Name: api/types
 * Purpose: single source of truth for protocol types shared between the H5
 *          client and the Express server.
 * Reason: previously these types were declared in `utils/tarot_reading.ts`
 *         and duplicated server-side. Centralising them here eliminates the
 *         drift risk and lets both render code and API code import from
 *         one canonical module.
 * Data flow: server JSON shapes flow in (via `client.request<T>`); the rest
 *           of the app consumes these types as plain TS interfaces.
 */

export type CardPosition = 'upright' | 'reversed'

/**
 * Supported divination spread kinds. Today only `single_card` is wired up
 * end-to-end; the union exists so future spreads can be added in one place
 * (here + the server's zod enum) instead of in every signature individually.
 */
export type SpreadKind = 'single_card'

export interface TarotCardMeaning {
  keywords: string[]
  meaning: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface TarotCardInfo {
  id: string
  name: string
  nameEn: string
  number: number
  type: 'major' | 'minor'
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles'
  /** Server-resolved URL, populated after `resolveAssetUrl` wraps it. */
  image: string
  upright: TarotCardMeaning
  reversed: TarotCardMeaning
}

/** Output of the local "drawn card" pipeline — card metadata + position. */
export interface DrawnResult {
  card: TarotCardInfo
  position: CardPosition
}

/** Server reply for a single drawn card, before client-side asset resolution. */
export interface DivinationDrawnEntry {
  cardId: string
  position: CardPosition
}

export interface ReadingCardDetail {
  card: TarotCardInfo
  position: CardPosition
  meaning: string
}

export interface ReadingResult {
  result: 'positive' | 'negative'
  score: number
  cardDetails: ReadingCardDetail[]
}

/** Top-level reply from `POST /api/v1/divinations`. */
export interface DivinationResponse {
  spreadKind: SpreadKind
  drawn: DivinationDrawnEntry[]
  reading: ReadingResult
}
