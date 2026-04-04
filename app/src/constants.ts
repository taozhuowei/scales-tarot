/**
 * Global constants shared across runtime platforms.
 */

export type TarotAssetPlatform = 'h5' | 'mp-weixin'

/**
 * Detect the active runtime so tarot image URLs resolve correctly on each platform.
 * H5 needs relative paths for subdirectory deploys; mp-weixin components need
 * package-root absolute paths to avoid resolving into /components/static/...
 */
export function detectTarotAssetPlatform(): TarotAssetPlatform {
  if (typeof globalThis !== 'undefined' && 'wx' in globalThis && typeof document === 'undefined') {
    return 'mp-weixin'
  }

  return 'h5'
}

/**
 * Tarot theme asset base. Source files live under src/static/themes/golden_dawn/tarot.
 */
export function getTarotThemeAssetBase(
  platform: TarotAssetPlatform = detectTarotAssetPlatform()
): string {
  return platform === 'mp-weixin'
    ? '/static/themes/golden_dawn/tarot'
    : './static/themes/golden_dawn/tarot'
}

export const TAROT_THEME_ASSET_BASE = getTarotThemeAssetBase()

/**
 * Card back image used by shuffle/cut/reveal states.
 */
export const CARD_BACK_IMAGE = `${TAROT_THEME_ASSET_BASE}/card_back.jpeg`
