// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  presentProgressHeader,
  presentFooter,
  presentPositionBadge,
  DEFAULT_OVERLAY_TEXT,
} from '../src/utils/overlay_progress/phase_progress_presenter'

describe('overlay_progress/phase_progress_presenter', () => {
  const mockGetIconAsset = vi.fn((name: string) => `/icons/${name}.png`)

  describe('presentProgressHeader', () => {
    it('presents all phases with correct active states', () => {
      const presentation = presentProgressHeader('cutting', mockGetIconAsset)

      expect(presentation.items).toHaveLength(4)
      expect(presentation.activeIndex).toBe(1)

      // First two should be active (current and completed)
      expect(presentation.items[0].isActive).toBe(true)
      expect(presentation.items[0].isCompleted).toBe(true)
      expect(presentation.items[1].isActive).toBe(true)
      expect(presentation.items[1].isCompleted).toBe(false)

      // Last two should be pending
      expect(presentation.items[2].isActive).toBe(false)
      // isPending is only in progress model, not presenter
      expect(presentation.items[3].isActive).toBe(false)
    })

    it('marks first two icons as compensated', () => {
      const presentation = presentProgressHeader('shuffling', mockGetIconAsset)

      expect(presentation.items[0].isCompensated).toBe(true)
      expect(presentation.items[1].isCompensated).toBe(true)
      expect(presentation.items[2].isCompensated).toBe(false)
    })

    it('includes correct icon paths for both active and inactive variants', () => {
      const presentation = presentProgressHeader('revealing', mockGetIconAsset)

      // Both variants are always resolved so the view layer can stack
      // them and crossfade via CSS opacity (eliminates phase-transition
      // color-change lag previously caused by lazy active-asset fetching).
      expect(presentation.items[0].iconSrcActive).toContain('icon_wands')
      expect(presentation.items[0].iconSrcInactive).toContain('icon_wands_inactive')
      expect(presentation.items[3].iconSrcActive).toContain('icon_pentacles')
      expect(presentation.items[3].iconSrcInactive).toContain('icon_pentacles_inactive')
    })
  })

  describe('presentFooter', () => {
    it('shows restart when results are shown', () => {
      const presentation = presentFooter('revealing', true)

      expect(presentation.showRestart).toBe(true)
      expect(presentation.showRevealingHint).toBe(false)
    })

    it('shows revealing hint during revealing phase without results', () => {
      const presentation = presentFooter('revealing', false)

      expect(presentation.showRestart).toBe(false)
      expect(presentation.showRevealingHint).toBe(true)
      expect(presentation.revealingText).toBe('神谕显现中')
    })

    it('shows neither during other phases', () => {
      const presentation = presentFooter('drawing', false)

      expect(presentation.showRestart).toBe(false)
      expect(presentation.showRevealingHint).toBe(false)
    })

    it('accepts custom overlay text', () => {
      const customText = {
        ...DEFAULT_OVERLAY_TEXT,
        revealing: 'Custom Message',
      }
      const presentation = presentFooter('revealing', false, customText)

      expect(presentation.revealingText).toBe('Custom Message')
    })
  })

  describe('presentPositionBadge', () => {
    it('returns upright badge correctly', () => {
      const badge = presentPositionBadge('upright')

      expect(badge.label).toBe('正')
      expect(badge.className).toBe('upright')
    })

    it('returns reversed badge correctly', () => {
      const badge = presentPositionBadge('reversed')

      expect(badge.label).toBe('逆')
      expect(badge.className).toBe('reversed')
    })

    it('defaults to upright for undefined', () => {
      const badge = presentPositionBadge(undefined)

      expect(badge.label).toBe('正')
      expect(badge.className).toBe('upright')
    })
  })

  describe('DEFAULT_OVERLAY_TEXT', () => {
    it('has all required text keys', () => {
      expect(DEFAULT_OVERLAY_TEXT.positionReversed).toBe('逆')
      expect(DEFAULT_OVERLAY_TEXT.positionUpright).toBe('正')
      expect(DEFAULT_OVERLAY_TEXT.restart).toBe('再占一次')
      expect(DEFAULT_OVERLAY_TEXT.revealing).toBe('神谕显现中')
    })
  })
})
