/**
 * Theme store (Pinia)
 * Manages theme state and provides computed helpers for theme assets.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchTheme, type ThemeData, type ThemeColors, type ThemeFonts } from '../core/api/themes'

export const useThemeStore = defineStore('theme', () => {
  // State
  const currentTheme = ref<ThemeData | null>(null)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  /**
   * Load theme from API
   * If no themeId provided, loads the default 'golden_dawn' theme
   */
  async function loadTheme(themeId?: string): Promise<void> {
    const id = themeId ?? 'golden_dawn'
    loadError.value = null
    isLoading.value = true
    try {
      currentTheme.value = await fetchTheme(id)
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load theme'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Card back image URL from theme, or empty string if not loaded
   */
  const cardBackImage = computed<string>(() => {
    return currentTheme.value?.images?.card_back ?? ''
  })

  /**
   * Theme UI assets, or empty object if not loaded.
   * Provides direct access to resolved icon / button asset URLs from theme.json.
   */
  const uiAssets = computed<Record<string, string>>(() => {
    const resolvedUi = currentTheme.value?.ui ?? {}
    return Object.entries(resolvedUi).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {})
  })

  /**
   * Read a single resolved UI asset URL by key.
   * Returns empty string when the asset is not configured in the current theme.
   */
  function getUiAsset(assetKey: string): string {
    return uiAssets.value[assetKey] ?? ''
  }

  /**
   * Theme colors, or null if not loaded
   */
  const colors = computed<ThemeColors | null>(() => {
    return currentTheme.value?.colors ?? null
  })

  /**
   * Theme fonts, or null if not loaded
   */
  const fonts = computed<ThemeFonts | null>(() => {
    return currentTheme.value?.fonts ?? null
  })

  return {
    currentTheme,
    isLoading,
    loadError,
    loadTheme,
    cardBackImage,
    uiAssets,
    getUiAsset,
    colors,
    fonts,
  }
})
