/**
 * Name: composables/flows/idle/deck_card_size
 * Purpose: resolve the idle fan-stack card width/height from the
 *          draw-stage layout solver so idle → divination keeps a stable
 *          card size with no visual jump.
 * Reason: split out of use_play_deck_animation — a single-responsibility
 *          idle-deck sizing helper. Body byte-identical to the original.
 * Data flow: solveLayoutFromWindow('draw_stage') → { cardWidth, cardHeight };
 *          falls back to 100×160 while the solver can't run yet.
 */

import { solveLayoutFromWindow } from '../../../core/sizing/solve_from_window'

/**
 * Resolve the fan-stack card width/height from the draw stage layout
 * solver. Mirrors the legacy idle composable so idle → divination keeps
 * stable card size with no visual jump.
 */
export function resolveDeckCardSize(): { cardWidth: number; cardHeight: number } {
  try {
    const { layout } = solveLayoutFromWindow('draw_stage')
    return {
      cardWidth: layout.drawCardWidth,
      cardHeight: layout.drawCardHeight,
    }
  } catch {
    return { cardWidth: 100, cardHeight: 160 }
  }
}
