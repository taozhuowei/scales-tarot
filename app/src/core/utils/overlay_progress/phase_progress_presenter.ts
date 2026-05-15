/**
 * Name: phase_progress_presenter
 * Purpose: transform progress model state into view-ready presentation data.
 * Reason: decouple progress state from specific rendering decisions.
 * Data flow: progress state flows in; presentation data flows out.
 */

import type { OverlayPhase } from '../../../animation/phases/registry'
import { getPhaseSteps } from '../../../animation/phases/registry'

export interface ProgressBarItem {
  phase: OverlayPhase
  label: string
  /**
   * Resolved active-variant icon URL. Always produced regardless of the
   * step's current `isActive` flag so the view layer can render both
   * variants stacked and toggle them via CSS opacity. Pre-rendering both
   * variants ensures the active asset is fetched and decoded at component
   * mount, eliminating the network/decode lag previously observed when
   * swapping `:src` at phase-transition time (113KB pentacles vs 63KB
   * inactive variant produced a visible 100–300ms color delay).
   */
  iconSrcActive: string
  /** Resolved inactive-variant icon URL (see `iconSrcActive` rationale). */
  iconSrcInactive: string
  isActive: boolean
  isCompleted: boolean
  isCompensated: boolean
}

export interface ProgressHeaderPresentation {
  items: ProgressBarItem[]
  activeIndex: number
}

export interface FooterPresentation {
  showRestart: boolean
  showRevealingHint: boolean
  revealingText: string
}

export interface OverlayText {
  positionReversed: string
  positionUpright: string
  restart: string
  backHome: string
  revealing: string
}

export const DEFAULT_OVERLAY_TEXT: OverlayText = {
  positionReversed: '逆',
  positionUpright: '正',
  restart: '再占一次',
  backHome: '回到首页',
  revealing: '神谕显现中',
}

export function presentProgressHeader(
  currentPhase: OverlayPhase,
  getIconAsset: (name: string) => string,
): ProgressHeaderPresentation {
  const activeIndex = getPhaseSteps().findIndex((s) => s.phase === currentPhase)

  const items = getPhaseSteps().map((step, index) => {
    const isActive = index <= activeIndex
    // Resolve both variants up-front. Each falls back to the other so a
    // missing asset never breaks rendering — the consumer always receives
    // two non-empty strings when at least one variant is registered.
    const activeAsset = getIconAsset(step.activeIcon) || getIconAsset(step.inactiveIcon) || ''
    const inactiveAsset = getIconAsset(step.inactiveIcon) || getIconAsset(step.activeIcon) || ''

    return {
      phase: step.phase,
      label: step.label,
      iconSrcActive: activeAsset,
      iconSrcInactive: inactiveAsset,
      isActive,
      isCompleted: index < activeIndex,
      isCompensated: index < 2,
    }
  })

  return { items, activeIndex }
}

export function presentFooter(
  currentPhase: OverlayPhase,
  showResults: boolean,
  text: OverlayText = DEFAULT_OVERLAY_TEXT,
): FooterPresentation {
  return {
    showRestart: showResults,
    showRevealingHint: currentPhase === 'revealing' && !showResults,
    revealingText: text.revealing,
  }
}

export function presentPositionBadge(
  position: 'upright' | 'reversed' | undefined,
  text: OverlayText = DEFAULT_OVERLAY_TEXT,
): { label: string; className: string } {
  return {
    label: position === 'reversed' ? text.positionReversed : text.positionUpright,
    className: position ?? 'upright',
  }
}
