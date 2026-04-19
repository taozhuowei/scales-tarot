/**
 * Name: phase_progress_presenter
 * Purpose: transform progress model state into view-ready presentation data.
 * Reason: decouple progress state from specific rendering decisions.
 * Data flow: progress state flows in; presentation data flows out.
 */

import type { OverlayPhase } from '../overlay_animation/phase_registry'
import { getPhaseSteps } from '../overlay_animation/phase_registry'

export interface ProgressBarItem {
  phase: OverlayPhase
  label: string
  iconSrc: string
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
    const iconName = isActive
      ? getIconAsset(step.activeIcon) || getIconAsset(step.inactiveIcon)
      : getIconAsset(step.inactiveIcon) || getIconAsset(step.activeIcon)

    return {
      phase: step.phase,
      label: step.label,
      iconSrc: iconName || '',
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
