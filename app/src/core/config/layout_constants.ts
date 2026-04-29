/**
 * Layout, animation, and interaction constants.
 *
 * Physical card sizing reservations now live in
 * `core/sizing/physical_reservations.ts`; this file holds the timing,
 * thresholds, and motion-magnitude values that don't fit there.
 *
 * Naming rule: every value is a concrete physical quantity — px, ms, or
 * a count. Fractions of the viewport (`*_FRACTION`, `*_RATIO`) are no
 * longer accepted; convert to a px reservation if you find yourself
 * reaching for one.
 */

// ---- Responsive breakpoint -------------------------------------------------

/** Minimum viewport width treated as "wide" (px). Below this we render the
 *  narrow / mobile layout. */
export const WIDE_BREAKPOINT = 768

// ---- Entry-animation durations (seconds, GSAP convention) ------------------

export const ENTRY_BG_FADE_DURATION = 0.7
export const ENTRY_CARDS_DROP_DURATION = 1.05
export const ENTRY_HEADER_SLIDE_DURATION = 0.4
export const ENTRY_FOOTER_SLIDE_DURATION = 0.35

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

/** Delay between the entry animation and the shuffle kick-off (ms). */
export const ENTRY_TO_SHUFFLE_DELAY_MS = 300

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
