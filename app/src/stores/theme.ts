/**
 * Theme store (Pinia)
 * Manages theme state and provides computed helpers for theme assets.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchTheme, type ThemeData, type ThemeColors, type ThemeFonts } from '../api/themes'

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
   * Extract theme base URL from resolved asset URL
   * Derives from any resolved URL in currentTheme, strips path after /static/themes/{id}/
   */
  const themeBase = computed<string>(() => {
    if (!currentTheme.value) return ''
    // Use card_back image URL to derive base path
    const cardBackUrl = currentTheme.value.images.card_back
    if (!cardBackUrl) return ''
    // Extract base URL up to /static/themes/{id}/
    const match = cardBackUrl.match(/(.+\/static\/themes\/[^/]+)\//)
    return match ? match[1] : ''
  })

  /**
   * Card back image URL from theme, or empty string if not loaded
   */
  const cardBackImage = computed<string>(() => {
    return currentTheme.value?.images?.card_back ?? ''
  })

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
    themeBase,
    cardBackImage,
    colors,
    fonts,
  }
})
