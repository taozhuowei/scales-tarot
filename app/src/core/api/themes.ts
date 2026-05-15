/**
 * Theme API client
 * Endpoints for fetching theme data from the backend. Asset URLs come from
 * the server as origin-relative paths; we rewrite them to full URLs via
 * resolveAssetUrl so the store can hand them to <image> / <img> directly.
 */

import { request, resolveAssetUrl } from './client'

export interface ThemeFontFace {
  family: string
  // weight → font file URL (e.g. { "400": "/static/themes/.../fonts/cinzel-400.woff2" }).
  // Keys match the server's theme.json font weight strings.
  weights: Record<string, string>
}

export interface ThemeFonts {
  display: ThemeFontFace
  body: ThemeFontFace
}

export interface ThemeColors {
  bg_primary: string
  bg_secondary: string
  bg_sunken: string
  bg_raised: string
  text_primary: string
  text_secondary: string
  text_tertiary: string
  text_muted: string
  accent: string
  accent_light: string
  accent_glow: string
  border: string
  border_strong: string
  yes: string
  no: string
}

export interface ThemeUI {
  btn_primary?: string
  [key: string]: string | undefined
}

export interface ThemeImages {
  card_back: string
  [key: string]: string | undefined
}

export interface ThemeData {
  id: string
  name: string
  description: string
  fonts: ThemeFonts
  ui: ThemeUI
  images: ThemeImages
  colors: ThemeColors
}

/**
 * Fetch a specific theme by ID.
 *
 * The server returns asset URLs as origin-relative paths
 * (e.g. /static/themes/.../card_back.jpeg); this helper rewrites every
 * URL-valued field so callers never see bare paths.
 */
export async function fetchTheme(themeId: string): Promise<ThemeData> {
  const raw = await request<ThemeData>(`/api/v1/themes/${themeId}`)
  return resolveThemeAssetUrls(raw)
}

function resolveThemeAssetUrls(theme: ThemeData): ThemeData {
  const mapStringValues = <T extends Record<string, string | undefined>>(obj: T): T => {
    const out = {} as Record<string, string | undefined>
    for (const [k, v] of Object.entries(obj)) {
      out[k] = v === undefined ? undefined : resolveAssetUrl(v)
    }
    return out as T
  }
  const mapWeights = (weights: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(weights)) out[k] = resolveAssetUrl(v)
    return out
  }
  return {
    ...theme,
    fonts: {
      display: { ...theme.fonts.display, weights: mapWeights(theme.fonts.display.weights) },
      body: { ...theme.fonts.body, weights: mapWeights(theme.fonts.body.weights) },
    },
    ui: mapStringValues(theme.ui),
    images: mapStringValues(theme.images),
  }
}
