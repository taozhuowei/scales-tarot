/**
 * Homepage settings panel tests
 * Tests settings UI behavior and spread selection state management
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTarotStore } from '../app/src/stores/tarot'
import { useThemeStore } from '../app/src/stores/theme'

// Mock the API modules
const mockFetchTheme = vi.hoisted(() => vi.fn())
const mockFetchAllCards = vi.hoisted(() => vi.fn())

vi.mock('../app/src/api/themes', () => ({
  fetchTheme: mockFetchTheme,
}))

vi.mock('../app/src/api/cards', () => ({
  fetchAllCards: mockFetchAllCards,
}))

describe('homepage settings panel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetchTheme.mockReset()
    mockFetchAllCards.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('theme store UI assets', () => {
    it('themeStore provides getUiAsset for settings icon', async () => {
      const store = useThemeStore()
      
      // Mock theme data
      mockFetchTheme.mockResolvedValue({
        id: 'golden_dawn',
        name: 'Golden Dawn',
        ui: {
          icon_settings: 'http://localhost:3000/static/themes/golden_dawn/ui/icon-settings.png',
        },
        images: { card_back: 'http://localhost:3000/static/themes/golden_dawn/tarot/card_back.jpeg' },
        colors: {},
        fonts: {},
      })

      await store.loadTheme('golden_dawn')

      // Should be able to get settings icon URL
      const settingsUrl = store.getUiAsset('icon_settings')
      expect(settingsUrl).toBe('http://localhost:3000/static/themes/golden_dawn/ui/icon-settings.png')
    })

    it('getUiAsset returns empty string for missing assets', async () => {
      const store = useThemeStore()
      
      mockFetchTheme.mockResolvedValue({
        id: 'minimal',
        name: 'Minimal',
        ui: {},
        images: { card_back: '' },
        colors: {},
        fonts: {},
      })

      await store.loadTheme('minimal')

      // Missing asset should return empty string
      const missingUrl = store.getUiAsset('icon_settings')
      expect(missingUrl).toBe('')
    })
  })

  describe('homepage idle state conditions', () => {
    it('store isIdle is true only in idle phase', () => {
      const store = useTarotStore()

      expect(store.isIdle).toBe(true)
      expect(store.phase).toBe('idle')

      store.startDivination('Test question')
      expect(store.isIdle).toBe(false)
      expect(store.phase).toBe('shuffling')

      store.reset()
      expect(store.isIdle).toBe(true)
      expect(store.phase).toBe('idle')
    })

  })

})
