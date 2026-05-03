/**
 * Layout, animation, and interaction constants.
 *
 * Proportional sizing tokens now live in `core/sizing/scale.ts`; this file
 * holds the timing, thresholds, and motion-magnitude values that don't fit
 * there.
 *
 * Naming rule: every value is a concrete physical quantity — px, ms, or
 * a count. Fractions of the viewport (`*_FRACTION`, `*_RATIO`) are no
 * longer accepted; convert to a px reservation if you find yourself
 * reaching for one.
 */

// ---- Hero typewriter timing (ms) ------------------------------------------

export const HERO_TITLE_START_DELAY = 180
export const HERO_TITLE_CHAR_INTERVAL = 38
export const HERO_QUESTION_START_DELAY = 420
export const HERO_QUESTION_CHAR_INTERVAL = 26

// ---- Overlay controller ---------------------------------------------------

/** Maximum number of result cards a future spread could ever ask for. The
 *  animation state allocates this many GSAP targets up front to keep
 *  refs / arrays aligned regardless of the active spread. */
export const MAX_CARD_COUNT = 10

/** Maximum number of cut piles the cut animation pre-allocates. */
export const MAX_CUT_PILES = 8

/** Delay between the draw landing and the auto-flip kick-off (ms). */
export const AUTO_REVEAL_DELAY_MS = 800

/**
 * Initial drawer height as a fraction of the viewport height (0..1).
 *
 * The drawer's top edge anchors to the result card's bottom so the drawer
 * naturally hugs the card. Historically `initialHeight` filled the entire
 * gap between that anchor and the safe-area bottom, which left the sheet
 * extremely shallow on tall phones (the card pushed the drawer down to a
 * sliver). Per new product requirement N3 the initial height now equals a
 * fixed fraction of the viewport — the drawer is allowed to overlap the
 * card on first reveal because the user can drag it back down to inspect
 * the card if needed. `maxHeight` still represents "fully expanded sheet"
 * and remains capped at viewport.height − safeAreaBottom.
 */
export const INITIAL_DRAWER_HEIGHT_RATIO = 0.4

/** Vertical margin added to the result-card lift transform so the bottom
 *  of the card never touches the drawer's top edge during the reveal. */
export const RESULT_LIFT_MARGIN_PX = 16

// ---- Shuffle motion -------------------------------------------------------

/** Default horizontal spread of the shuffle fan when motion-metrics
 *  produce a degenerate value (very narrow viewport). */
export const SHUFFLE_SPREAD_X = 120

/** Padding kept between the outermost shuffle card and the safe-frame edge
 *  so cards never visually clip the stage during the riffle. */
export const SHUFFLE_EDGE_MARGIN = 12

// ---- Interaction safety ---------------------------------------------------

/** Minimum gap between deck-click events to debounce double-taps (ms). */
export const DECK_CLICK_SAFETY_MS = 2000
