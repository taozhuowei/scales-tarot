/**
 * Theme API client
 * Endpoints for fetching theme data from the backend.
 */

import { request } from './client'

export interface ThemeFonts {
  display: {
    family: string
    weights: number[]
  }
  body: {
    family: string
    weights: number[]
  }
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

export interface ThemeIcons {
  cups: string
  pentacles: string
  swords: string
  wands: string
}

export interface ThemeImages {
  card_back: string
  btn_primary?: string
}

export interface ThemeSummary {
  id: string
  name: string
  description: string
}

export interface ThemeData {
  id: string
  name: string
  description: string
  fonts: ThemeFonts
  icons: ThemeIcons
  images: ThemeImages
  colors: ThemeColors
}

interface FetchThemesResponse {
  themes: ThemeSummary[]
}

/**
 * Fetch list of all available themes
 */
export async function fetchThemes(): Promise<ThemeSummary[]> {
  const res = await request<FetchThemesResponse>('/api/v1/themes')
  return res.themes
}

/**
 * Fetch a specific theme by ID
 */
export async function fetchTheme(themeId: string): Promise<ThemeData> {
  return request<ThemeData>(`/api/v1/themes/${themeId}`)
}
