/**
 * Theme Loader Service
 * Loads theme configurations from theme directories, resolves asset paths to full URLs,
 * and caches the results for efficient access.
 */

import * as fs from 'fs'
import * as path from 'path'

// All asset URLs returned from this service are ORIGIN-RELATIVE paths
// (e.g. /static/themes/golden_dawn/tarot/card_back.jpeg). Clients resolve
// them against their own origin — H5 against the page origin, mini-program
// against VITE_API_BASE_URL — so no host ever ends up hard-coded in the
// API payload.

// Theme directory path (relative to server/src/services)
const THEMES_DIR = path.join(__dirname, '..', '..', 'public', 'static', 'themes')

/**
 * Font weight mapping: weight value -> relative path to font file
 */
export interface FontWeights {
  [weight: string]: string
}

/**
 * Font configuration for display or body text
 */
export interface FontConfig {
  family: string
  weights: FontWeights
}

/**
 * Theme fonts configuration
 */
export interface ThemeFonts {
  display: FontConfig
  body: FontConfig
}

/**
 * Theme UI assets mapping: icons + other UI elements -> relative paths
 */
export interface ThemeUI {
  btn_primary?: string
  [key: string]: string | undefined
}

/**
 * Theme images mapping: non-UI images -> relative paths
 */
export interface ThemeImages {
  card_back: string
  [key: string]: string | undefined
}

/**
 * Theme colors configuration
 */
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
  [key: string]: string | undefined
}

/**
 * Font configuration with resolved URLs
 */
export interface ResolvedFontConfig {
  family: string
  weights: { [weight: string]: string }
}

/**
 * Theme fonts with resolved URLs
 */
export interface ResolvedThemeFonts {
  display: ResolvedFontConfig
  body: ResolvedFontConfig
}

/**
 * Complete theme data with resolved URLs
 */
export interface ThemeData {
  id: string
  name: string
  description: string
  fonts: ResolvedThemeFonts
  ui: { [key: string]: string }
  images: { [key: string]: string }
  colors: ThemeColors
}

/**
 * Theme summary for listing themes
 */
export interface ThemeSummary {
  id: string
  name: string
  description: string
}

/**
 * Raw theme data from JSON file
 */
interface RawThemeData {
  id: string
  name: string
  description: string
  fonts: ThemeFonts
  ui: ThemeUI
  images: ThemeImages
  colors: ThemeColors
}

// Cache for loaded themes
const themeCache = new Map<string, ThemeData>()

/**
 * Resolve a relative path to a full static URL
 * @param themeId - The theme identifier
 * @param relativePath - The relative path from theme.json
 * @returns Full URL to the asset
 */
function resolvePath(themeId: string, relativePath: string): string {
  return `/static/themes/${themeId}/${relativePath}`
}

/**
 * Resolve all relative paths in font weights to full URLs
 * @param themeId - The theme identifier
 * @param weights - Font weights mapping
 * @returns Resolved font weights with full URLs
 */
function resolveFontWeights(
  themeId: string,
  weights: FontWeights
): { [weight: string]: string } {
  const resolved: { [weight: string]: string } = {}
  for (const [weight, relativePath] of Object.entries(weights)) {
    resolved[weight] = resolvePath(themeId, relativePath)
  }
  return resolved
}

/**
 * Resolve all font paths in the fonts configuration
 * @param themeId - The theme identifier
 * @param fonts - Raw fonts configuration
 * @returns Fonts configuration with resolved URLs
 */
function resolveFonts(themeId: string, fonts: ThemeFonts): ResolvedThemeFonts {
  return {
    display: {
      family: fonts.display.family,
      weights: resolveFontWeights(themeId, fonts.display.weights)
    },
    body: {
      family: fonts.body.family,
      weights: resolveFontWeights(themeId, fonts.body.weights)
    }
  }
}

/**
 * Resolve all relative paths in a string-valued record to full URLs
 * @param themeId - The theme identifier
 * @param images - Raw images mapping
 * @returns Images mapping with full URLs
 */
function resolveAssetPaths(
  themeId: string,
  images: Record<string, string | undefined>
): { [key: string]: string } {
  const resolved: { [key: string]: string } = {}
  for (const [name, relativePath] of Object.entries(images)) {
    if (relativePath !== undefined) {
      resolved[name] = resolvePath(themeId, relativePath)
    }
  }
  return resolved
}

/**
 * Load and parse a theme from its directory
 * @param themeId - The theme identifier (directory name)
 * @returns ThemeData with resolved URLs, or undefined if theme not found
 * @throws Error if theme.json is missing or invalid
 */
export function getTheme(themeId: string): ThemeData | undefined {
  // Check cache first
  const cached = themeCache.get(themeId)
  if (cached) {
    return cached
  }

  // Build path to theme.json
  const themeDir = path.join(THEMES_DIR, themeId)
  const themeJsonPath = path.join(themeDir, 'theme.json')

  // Check if theme.json exists
  if (!fs.existsSync(themeJsonPath)) {
    return undefined
  }

  // Read and parse theme.json
  let rawData: RawThemeData
  try {
    const content = fs.readFileSync(themeJsonPath, 'utf-8')
    rawData = JSON.parse(content) as RawThemeData
  } catch (error: unknown) {
    throw new Error(`Failed to parse theme.json for theme '${themeId}'`, { cause: error })
  }

  // Resolve all paths and construct ThemeData
  const themeData: ThemeData = {
    id: rawData.id,
    name: rawData.name,
    description: rawData.description,
    fonts: resolveFonts(themeId, rawData.fonts),
    ui: resolveAssetPaths(themeId, rawData.ui),
    images: resolveAssetPaths(themeId, rawData.images),
    colors: rawData.colors
  }

  // Cache the result
  themeCache.set(themeId, themeData)

  return themeData
}

/**
 * Get the default theme (golden_dawn)
 * @returns ThemeData for the default theme, or undefined if not found
 */
export function getDefaultTheme(): ThemeData | undefined {
  return getTheme('golden_dawn')
}

/**
 * List all available themes by scanning the themes directory
 * @returns Array of ThemeSummary for each valid theme
 */
export function listThemes(): ThemeSummary[] {
  const themes: ThemeSummary[] = []

  // Check if themes directory exists
  if (!fs.existsSync(THEMES_DIR)) {
    return themes
  }

  // Scan for theme directories
  const entries = fs.readdirSync(THEMES_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const themeId = entry.name
    const themeJsonPath = path.join(THEMES_DIR, themeId, 'theme.json')

    // Check if theme.json exists in this directory
    if (!fs.existsSync(themeJsonPath)) {
      continue
    }

    // Read theme.json to get summary info
    try {
      const content = fs.readFileSync(themeJsonPath, 'utf-8')
      const data = JSON.parse(content) as RawThemeData
      themes.push({
        id: data.id || themeId,
        name: data.name || themeId,
        description: data.description || ''
      })
    } catch {
      // Skip invalid theme.json files
      continue
    }
  }

  return themes
}

/**
 * Clear the theme cache
 * Useful for reloading themes during development
 */
export function clearThemeCache(): void {
  themeCache.clear()
}

/**
 * Get a cached theme without file system access
 * @param themeId - The theme identifier
 * @returns Cached ThemeData or undefined
 */
export function getCachedTheme(themeId: string): ThemeData | undefined {
  return themeCache.get(themeId)
}
