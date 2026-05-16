/**
 * Name: result_card_lift_margin
 * Purpose: vertical breathing margin (px) added to the result-card lift
 *          transform so the card's bottom never touches the reading
 *          drawer's top edge when the bottom sheet opens on narrow
 *          viewports.
 * Reason: split out of use_overlay.ts ahead of that facade's dead-code
 *         removal. Semantically a reading-flow constant (result card ↔
 *         reading drawer visual contract); the sole live consumer is
 *         Deck.vue's resultCardLiftY computed.
 */

/** Vertical margin added to the result-card lift transform so the bottom
 *  of the card never touches the drawer's top edge during the reveal. */
export const RESULT_LIFT_MARGIN_PX = 16
