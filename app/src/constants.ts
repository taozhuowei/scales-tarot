/**
 * Fallback constants for static asset URLs.
 *
 * API base URL is defined in app/src/api/client.ts via VITE_API_BASE_URL.
 * Production mini program: configure VITE_API_BASE_URL in .env.production.
 *
 * Fallback values used before theme loads. Theme store overrides these.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const THEME_BASE = `${API_BASE}/static/themes/golden_dawn`

/** Fallback card back image used during shuffle / cut / draw animations */
export const CARD_BACK_IMAGE = `${THEME_BASE}/tarot/card_back.jpeg`

/** Fallback base URL for suit icons used in the progress header of DivinationOverlay */
export function getStaticIconBase(): string {
  return `${API_BASE}/static/icons`
}
