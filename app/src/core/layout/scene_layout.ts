/**
 * Name: scene_layout
 * Purpose: compose safe frame + spread registry + size solver + layout resolver into draw/result scene layout outputs.
 * Reason: this is the single public entry point for layout consumed by controller and tests.
 * Data flow: viewport + spread metadata flow in; scene layouts and motion plans flow out.
 */

import type { ViewportMetrics, SafeFrame } from '../viewport/types'
import { resolveSafeFrame, resolveStageMetrics, getDefaultInsets } from '../viewport/safe_frame_calculator'
import type { SpreadId, SpreadScene, CardEnvelope } from '../../utils/overlay_layout/spread_spec'
import { resolveCardSize as resolveCoreCardSize } from '../sizing/card_size_solver'
import { resolveDrawLayout, type DrawLayoutResult } from './draw_layout_resolver'
import { resolveResultLayout } from './result_layout_resolver'
import { getSpreadSlots, resolveSpreadSpec, getSpreadCardCount } from './spread_registry'
import { getBuiltInEnvelopeRequirement } from '../../utils/overlay_layout/spread_spec'
import { resolveSpreadSlots } from './spread_layout_calculator'
import { resolveMotionMetrics, type MotionMetrics } from '../../utils/overlay_layout/motion_metrics'
import * as LC from '../config/layout_constants'

export interface SceneLayoutInput {
  spreadId: SpreadId
  scene: SpreadScene
  viewport: ViewportMetrics
  isWide: boolean
  cardAspectRatio: number
  focusScale?: number
  badgeOverflowPx?: number
  headerHeight?: number
  resultSheetFraction?: number
}

export interface SceneLayoutResult extends DrawLayoutResult {
  cardWidth: number
  cardHeight: number
  safeTopInset: number
  safeBottomInset: number
  safeSideInset: number
  envelope: CardEnvelope
}

/** Backward-compatible alias used by controller. */
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function resolveOverlayViewport(input: {
  windowWidth: number
  windowHeight: number
  isWide: boolean
  showResults: boolean
  menuButtonRect?: { top: number; height: number } | null
}): ViewportMetrics & {
  stageWidth: number
  stageHeight: number
  stageContainerHeight: number
  resultHeight: number
  topBarHeight: number
} {
  const { windowWidth, windowHeight, isWide, showResults, menuButtonRect } = input
  const isMiniProgram = typeof menuButtonRect === 'object' && menuButtonRect !== null
  const topBarHeight = isMiniProgram
    ? menuButtonRect!.top + menuButtonRect!.height + 8
    : 0

  const insets = getDefaultInsets(windowWidth, isMiniProgram)

  const stageMetrics = resolveStageMetrics(
    { width: windowWidth, height: windowHeight, safeAreaTop: 0, safeAreaBottom: 0, dpr: 1 },
    insets,
    { isWide, showResults, topBarHeight },
  )

  return {
    width: windowWidth,
    height: windowHeight,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    dpr: 1,
    stageWidth: stageMetrics.stageWidth,
    stageHeight: stageMetrics.stageHeight,
    stageContainerHeight: stageMetrics.stageContainerHeight,
    resultHeight: stageMetrics.resultHeight,
    topBarHeight,
  }
}

export function buildOverlaySafeFrame(
  scene: SpreadScene,
  viewport: ViewportMetrics & { stageWidth: number; stageHeight: number; topBarHeight: number },
  resultSheetFraction?: number,
): SafeFrame {
  const isMiniProgram = false // Simplified: actual detection done in resolveOverlayViewport
  const insets = getDefaultInsets(viewport.width, isMiniProgram)

  const safeFrame = resolveSafeFrame(
    viewport,
    insets,
    {
      scene,
      topBarHeight: viewport.topBarHeight,
      precomputedStage: {
        stageWidth: viewport.stageWidth,
        stageHeight: viewport.stageHeight,
        headerBottom: viewport.topBarHeight + Math.round((insets.headerMarginRpx / 750) * viewport.width) + insets.headerIconSize,
        footerReserve: Math.max(insets.footerReserveMinPx, Math.round((insets.footerReserveRpx / 750) * viewport.width)),
      },
    },
  )

  // Apply result-sheet bottom inset if requested (draw_stage reserves space for upcoming sheet)
  if (resultSheetFraction && resultSheetFraction > 0 && scene === 'draw_stage') {
    const resultSheetBottomInset = Math.round(viewport.stageHeight * resultSheetFraction)
    const newHeight = Math.max(0, safeFrame.height - resultSheetBottomInset)
    const newCenterY = safeFrame.centerY - resultSheetBottomInset / 2
    return {
      ...safeFrame,
      height: newHeight,
      centerY: newCenterY,
    }
  }

  return safeFrame
}

/**
 * Resolve a spread layout inside the overlay safe frame, then map it back into stage coordinates.
 */
export function resolveSceneLayout(input: SceneLayoutInput): SceneLayoutResult {
  const { spreadId, scene, viewport, isWide, cardAspectRatio, focusScale, badgeOverflowPx, headerHeight, resultSheetFraction } = input

  const overlayViewport = resolveOverlayViewport({
    windowWidth: viewport.width,
    windowHeight: viewport.height,
    isWide,
    showResults: scene === 'result_stage',
  })

  const safeFrame = buildOverlaySafeFrame(scene, overlayViewport, resultSheetFraction)

  const cardSize = resolveCoreCardSize({
    safeFrame,
    cardAspectRatio,
    requirement: getBuiltInEnvelopeRequirement(spreadId, isWide),
    focusScale,
    badgeOverflowPx,
  })

  const spec = resolveSpreadSpec(spreadId, isWide)
  const slotDefs = getSpreadSlots(spreadId, isWide)
  const slots = resolveSpreadSlots(
    { ...spec, slots: slotDefs, wideSlots: isWide ? slotDefs : (spec.wideSlots ?? slotDefs) },
    isWide,
    cardSize,
  )

  const spread = scene === 'draw_stage'
    ? resolveDrawLayout(spreadId, slots, safeFrame, cardSize, spec.zIndexes)
    : resolveResultLayout(spreadId, slots, safeFrame, cardSize, headerHeight, spec.zIndexes)

  const halfSafeHeight = safeFrame.height / 2
  const envelopeFullSpanY = cardSize.height * spec.verticalSlots + (spec.verticalSlots - 1) * cardSize.gap
  const halfLayoutHeight = envelopeFullSpanY / 2
  const maxYOffset = Math.max(0, halfSafeHeight - halfLayoutHeight)
  const clampedCenterYOffset = Math.max(-maxYOffset, Math.min(maxYOffset, safeFrame.centerY))

  const mappedCards = spread.cards.map(card => ({
    ...card,
    y: card.y + clampedCenterYOffset,
  }))

  return {
    cards: mappedCards,
    stageShiftY: spread.stageShiftY,
    cardWidth: spread.cards[0]?.width ?? cardSize.width,
    cardHeight: spread.cards[0]?.height ?? cardSize.height,
    safeTopInset: safeFrame.y,
    safeBottomInset: safeFrame.bottomInset,
    safeSideInset: safeFrame.x,
    envelope: {
      cardWidth: cardSize.width,
      cardHeight: cardSize.height,
      gap: cardSize.gap,
      horizontalSlots: spec.horizontalSlots,
      verticalSlots: spec.verticalSlots,
      slotPitchX: cardSize.width + cardSize.gap,
      slotPitchY: cardSize.height + cardSize.gap,
      halfSpanX: ((spec.horizontalSlots - 1) * (cardSize.width + cardSize.gap)) / 2,
      halfSpanY: ((spec.verticalSlots - 1) * (cardSize.height + cardSize.gap)) / 2,
      fullSpanX: spec.horizontalSlots * cardSize.width + (spec.horizontalSlots - 1) * cardSize.gap,
      fullSpanY: spec.verticalSlots * cardSize.height + (spec.verticalSlots - 1) * cardSize.gap,
    },
  }
}

/**
 * Resolve cut offsets that stay inside the safe frame, anchored on the shared envelope.
 */
export function resolveCutLayout(input: {
  viewport: ViewportMetrics
  isWide: boolean
  cardAspectRatio: number
  spreadId: SpreadId
  focusScale?: number
  badgeOverflowPx?: number
}): CutLayoutResult {
  const { viewport, isWide, cardAspectRatio, spreadId, focusScale, badgeOverflowPx } = input
  const overlayViewport = resolveOverlayViewport({
    windowWidth: viewport.width,
    windowHeight: viewport.height,
    isWide,
    showResults: false,
  })
  const safeFrame = buildOverlaySafeFrame('draw_stage', overlayViewport)
  const envelope = resolveCoreCardSize({
    safeFrame,
    cardAspectRatio,
    requirement: getBuiltInEnvelopeRequirement(spreadId, isWide),
    focusScale,
    badgeOverflowPx,
  })

  const slotPitchX = envelope.width + envelope.gap
  const slotPitchY = envelope.height + envelope.gap

  if (isWide) {
    return {
      leadingOffsetX: -slotPitchX,
      leadingOffsetY: 0,
      trailingOffsetX: slotPitchX,
      trailingOffsetY: 0,
    }
  }

  return {
    leadingOffsetX: 0,
    leadingOffsetY: -slotPitchY,
    trailingOffsetX: 0,
    trailingOffsetY: slotPitchY,
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
  return isWide ? LC.FOCUS_SCALE_WIDE : LC.FOCUS_SCALE_NARROW
}

/** Badge overflow in px beyond card edge (12rpx). */
export function getBadgeOverflowPx(windowWidth: number): number {
  return Math.round((12 / 750) * windowWidth)
}

export { resolveMotionMetrics }
export type { MotionMetrics }
export { getSpreadCardCount }
