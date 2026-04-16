/**
 * Name: scene_layout
 * Purpose: compose safe frame + spread registry + size solver + spread solver into draw/result scene layout outputs.
 * Reason: this is the single public entry point for layout consumed by controller and tests.
 * Data flow: viewport + spread metadata flow in; scene layouts and motion plans flow out.
 */

import type { OverlayViewportMetrics } from '../overlay_viewport'
import { resolveOverlaySafeFrame, type OverlaySafeFrame } from './overlay_safe_frame'
import type { SpreadId, SpreadScene, CardEnvelope, SpreadLayoutResult } from './spread_spec'
import { resolveCardSize } from './card_size_solver'
import { resolveSpreadLayout } from './spread_solver'
import { getBuiltInEnvelopeRequirement } from './spread_spec'
import { resolveMotionMetrics, type MotionMetrics } from './motion_metrics'


export interface SceneLayoutInput {
  spreadId: SpreadId
  scene: SpreadScene
  viewport: OverlayViewportMetrics
  isWide: boolean
  cardAspectRatio: number
  focusScale?: number
  badgeOverflowPx?: number
  headerHeight?: number
}

export interface SceneLayoutResult extends SpreadLayoutResult {
  safeTopInset: number
  safeBottomInset: number
  safeSideInset: number
  envelope: CardEnvelope
}

/** Backward-compatible alias used by controller and shims. */
export type SceneLayout = SceneLayoutResult

export interface CutLayoutResult {
  leadingOffsetX: number
  leadingOffsetY: number
  trailingOffsetX: number
  trailingOffsetY: number
}

export interface RevealMotionPlan {
  focusScale: number
  dockScale: number
}

/**
 * Resolve a spread layout inside the overlay safe frame, then map it back into stage coordinates.
 */
export function resolveSceneLayout(input: SceneLayoutInput): SceneLayoutResult {
  const { spreadId, scene, viewport, isWide, cardAspectRatio, focusScale, badgeOverflowPx, headerHeight } = input
  const safeFrame = resolveOverlaySafeFrame(scene, viewport)

  const envelope = resolveCardSize({
    safeWidth: safeFrame.width,
    safeHeight: safeFrame.height,
    cardAspectRatio,
    ...getBuiltInEnvelopeRequirement(spreadId, isWide),
    focusScale,
    badgeOverflowPx,
  })

  const spread = resolveSpreadLayout({
    spreadId,
    scene,
    containerWidth: safeFrame.width,
    containerHeight: safeFrame.height,
    isWide,
    envelope,
    headerHeight,
  })

  const halfSafeHeight = safeFrame.height / 2
  const halfLayoutHeight = envelope.fullSpanY / 2
  const maxYOffset = Math.max(0, halfSafeHeight - halfLayoutHeight)
  const clampedCenterYOffset = Math.max(-maxYOffset, Math.min(maxYOffset, safeFrame.centerYOffset))

  return {
    ...spread,
    cards: spread.cards.map(card => ({
      ...card,
      y: card.y + clampedCenterYOffset,
    })),
    safeTopInset: safeFrame.topInset,
    safeBottomInset: safeFrame.bottomInset,
    safeSideInset: safeFrame.sideInset,
    envelope,
  }
}

/**
 * Resolve cut offsets that stay inside the safe frame, anchored on the shared envelope.
 */
export function resolveCutLayout(input: {
  viewport: OverlayViewportMetrics
  isWide: boolean
  cardAspectRatio: number
  spreadId: SpreadId
  focusScale?: number
  badgeOverflowPx?: number
}): CutLayoutResult {
  const { viewport, isWide, cardAspectRatio, spreadId, focusScale, badgeOverflowPx } = input
  const safeFrame = resolveOverlaySafeFrame('draw_stage', viewport)
  const envelope = resolveCardSize({
    safeWidth: safeFrame.width,
    safeHeight: safeFrame.height,
    cardAspectRatio,
    ...getBuiltInEnvelopeRequirement(spreadId, isWide),
    focusScale,
    badgeOverflowPx,
  })

  if (isWide) {
    return {
      leadingOffsetX: -envelope.slotPitchX,
      leadingOffsetY: 0,
      trailingOffsetX: envelope.slotPitchX,
      trailingOffsetY: 0,
    }
  }

  return {
    leadingOffsetX: 0,
    leadingOffsetY: -envelope.slotPitchY,
    trailingOffsetX: 0,
    trailingOffsetY: envelope.slotPitchY,
  }
}

/**
 * Resolve the flip emphasis scale before cards are collected into the result layout.
 * The CSS focus scale is the real source of truth; this helper just mirrors it for JS bounds.
 */
export function resolveRevealMotion(input: {
  drawCardWidth: number
  resultCardWidth: number
}): RevealMotionPlan {
  const { drawCardWidth, resultCardWidth } = input
  const preferredReadableWidth = clamp(
    Math.max(drawCardWidth * 1.12, resultCardWidth * 1.12),
    144,
    188,
  )

  return {
    focusScale: clamp(preferredReadableWidth / Math.max(drawCardWidth, 1), 1.08, 1.18),
    dockScale: 1,
  }
}

/** Focus scale used by CSS; layout must reserve bounds for this. */
export function getFocusScale(isWide: boolean): number {
  return isWide ? 1.2 : 1.42
}

/** Badge overflow in px beyond card edge (12rpx). */
export function getBadgeOverflowPx(windowWidth: number): number {
  return Math.round((12 / 750) * windowWidth)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export type { OverlaySafeFrame } from './overlay_safe_frame'
export { resolveMotionMetrics }
export type { MotionMetrics }
