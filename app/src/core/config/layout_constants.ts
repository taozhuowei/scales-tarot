/**
 * Layout and sizing constants.
 * All fixed ratios, insets, and thresholds are centralized here.
 */

// Result stage ratios
export const RESULT_NARROW_HEIGHT_FRACTION = 0.42
export const RESULT_WIDE_WIDTH_FRACTION = 0.54
export const RESULT_SHEET_FRACTION = 0.30

// Card visual constants
export const CARD_ASPECT_RATIO = 1.6

// Viewport / safe-frame insets (px unless noted)
export const HEADER_ICON_SIZE = 44
export const HEADER_MARGIN_RPX_H5 = 60
export const HEADER_MARGIN_RPX_MP = 140
export const HEADER_MARGIN_MAX_PX = 80
export const FOOTER_RESERVE_RPX_H5 = 164
export const FOOTER_RESERVE_RPX_MP = 196
export const FOOTER_RESERVE_MIN_PX = 48
export const FOOTER_RESERVE_MAX_PX = 120

export const SIDE_INSET_DRAW = 20 // 稍微收紧侧边距
export const SIDE_INSET_RESULT = 16
export const TOP_EXTRA_DRAW = 8 // 减少顶部额外留白
export const TOP_EXTRA_RESULT = 4
export const BOTTOM_MIN_DRAW = 40
export const BOTTOM_MIN_RESULT = 32
export const BOTTOM_RATIO_DRAW = 0.12 // 从 0.2 下调，释放更多垂直空间
export const BOTTOM_RATIO_RESULT = 0.1 // 从 0.16 下调

// Rounding / clamping
export const MIN_CARD_WIDTH = 64
export const MAX_CARD_WIDTH = 512
// Inter-card gap and edge margin share the same pixel value so the safe frame
// looks visually balanced (2 edge margins + (n-1) inter-card gaps + n cards).
export const DEFAULT_ENVELOPE_GAP = 16


// Entry animation durations (seconds)
export const ENTRY_BG_FADE_DURATION = 0.7
export const ENTRY_CARDS_DROP_DURATION = 1.05
export const ENTRY_HEADER_SLIDE_DURATION = 0.4
export const ENTRY_FOOTER_SLIDE_DURATION = 0.35

// Hero section typewriter timing (ms)
export const HERO_TITLE_START_DELAY = 180
export const HERO_TITLE_CHAR_INTERVAL = 38
export const HERO_QUESTION_START_DELAY = 420
export const HERO_QUESTION_CHAR_INTERVAL = 26
// Responsive breakpoint
export const WIDE_BREAKPOINT = 768

// Overlay controller constants
export const MAX_CARD_COUNT = 10
export const MAX_CUT_PILES = 8
export const AUTO_REVEAL_DELAY_MS = 800
export const ENTRY_TO_SHUFFLE_DELAY_MS = 300
export const RESULT_LIFT_MARGIN_PX = 16
export const RESULT_LIFT_MAX_FRACTION = 0.28

// Shuffle phase constants
export const SHUFFLE_SPREAD_X = 120
export const SHUFFLE_EDGE_MARGIN = 12

// Interaction safety
export const DECK_CLICK_SAFETY_MS = 2000
