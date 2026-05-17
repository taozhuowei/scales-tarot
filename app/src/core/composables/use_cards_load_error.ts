/**
 * Name: core/composables/use_cards_load_error
 * Purpose: surface the idle-only card-resource load error state + retry
 *          action, self-served from the tarot store, so the CardsLoadError
 *          component carries no props/emit chain.
 * Data flow: tarotStore ──▶ cardsLoadError / isCardsLoading refs; retry()
 *          dispatches loadCards(), and is a no-op while a load is in flight.
 */
import { storeToRefs } from 'pinia'
import { useTarotStore } from '../store/tarot'

export interface CardsLoadError {
  /** Non-null when card resources failed to load (idle-only band trigger). */
  cardsLoadError: ReturnType<typeof storeToRefs<ReturnType<typeof useTarotStore>>>['cardsLoadError']
  /** True while a (re)load is in flight — disables the retry affordance. */
  isCardsLoading: ReturnType<typeof storeToRefs<ReturnType<typeof useTarotStore>>>['isCardsLoading']
  /** Re-dispatch the card load; ignored while a load is already running. */
  retry: () => void
}

export function useCardsLoadError(): CardsLoadError {
  const tarotStore = useTarotStore()
  const { cardsLoadError, isCardsLoading } = storeToRefs(tarotStore)

  function retry() {
    if (isCardsLoading.value) return
    tarotStore.loadCards()
  }

  return { cardsLoadError, isCardsLoading, retry }
}
