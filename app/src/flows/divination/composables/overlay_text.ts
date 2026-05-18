/**
 * Name: flows/divination/composables/overlay_text
 * Purpose: static UI copy for the divination overlay (position badges,
 *          restart / back-home / revealing labels) and the `OverlayText`
 *          shape they conform to.
 * Reason: split out of phase_progress_presenter.ts so the presenter stays a
 *          pure state→view projection and the copy is an independent,
 *          reusable resource with no presentation logic attached.
 */

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
