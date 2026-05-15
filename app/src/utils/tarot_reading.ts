/**
 * Name: utils/tarot_reading
 * Purpose: thin re-export shim that preserves the historical import path
 *          while protocol types now live in `api/types.ts`.
 * Reason: 11 modules across stores, components, and composables already
 *         import from this module. Pointing them at the new canonical
 *         types via re-export avoids a sweeping rename and lets us delete
 *         the old `drawCards` random-draw helper (the backend now owns
 *         drawing — see `api/divinations.ts`).
 *
 * NOTE: do NOT add new exports here. New code should import directly
 *       from `app/src/api/types.ts`. This shim exists for backward
 *       compatibility only and may be removed once consumers migrate.
 */

export type {
  CardPosition,
  TarotCardMeaning,
  TarotCardInfo,
  DrawnResult,
  DivinationDrawnEntry,
  ReadingCardDetail,
  ReadingResult,
  DivinationResponse,
} from '../core/api/types'
