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
import { getBaseEnvelopeRequirement, getResultEnvelopeRequirement } from '../../utils/overlay_layout/spread_spec'
import { resolveSpreadSlots } from './spread_layout_calculator'
import { resolveMotionMetrics, type MotionMetrics } from '../../utils/overlay_layout/motion_metrics'
import * as LC from '../config/layout_constants'

export interface SceneLayoutInput {
  spreadId: SpreadId
  scene: SpreadScene
  viewport: ViewportMetrics
  isWide: boolean
  cardAspectRatio: number
  headerHeight?: number
  resultSheetFraction?: number
}

export interface SceneLayoutResult extends DrawLayoutResult {
  cardWidth: number
  cardHeight: number
  drawCardWidth: number
  drawCardHeight: number
  safeTopInset: number
  safeBottomInset: number
  safeSideInset: number
  envelope: CardEnvelope
}

/** Backward-compatible alias used by controller. */
export type SceneLayout = SceneLayoutResult

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
  const { spreadId, scene, viewport, isWide, cardAspectRatio, headerHeight, resultSheetFraction } = input

  const overlayViewport = resolveOverlayViewport({
    windowWidth: viewport.width,
    windowHeight: viewport.height,
    isWide,
    showResults: scene === 'result_stage',
  })

  const safeFrame = buildOverlaySafeFrame(scene, overlayViewport, resultSheetFraction)

  // Base sizing: use the full-screen view (showResults=false) for stability,
  // but reserve the result-sheet bottom inset so the draw layout already knows
  // the drawer space and never gets occluded by it.
  const baseOverlayViewport = resolveOverlayViewport({
    windowWidth: viewport.width,
    windowHeight: viewport.height,
    isWide,
    showResults: false,
  })
  const drawSizingFrame = buildOverlaySafeFrame(
    'draw_stage',
    baseOverlayViewport,
    resultSheetFraction ?? LC.RESULT_SHEET_FRACTION,
  )
  const drawCardSize = resolveCoreCardSize({
    safeFrame: drawSizingFrame,
    cardAspectRatio,
    requirement: getBaseEnvelopeRequirement(isWide),
  })

  // Result sizing: independently calculated based on the actual spread slots.
  const isResult = scene === 'result_stage'
  const resultCardSize = isResult
    ? resolveCoreCardSize({
        safeFrame, // Use current (potentially shrunk) safeFrame for result display
        cardAspectRatio,
        requirement: getResultEnvelopeRequirement(spreadId, isWide),
      })
    : drawCardSize

  const currentCardSize = isResult ? resultCardSize : drawCardSize

  const spec = resolveSpreadSpec(spreadId, isWide)
  const slotDefs = getSpreadSlots(spreadId, isWide)
  const slots = resolveSpreadSlots(
    { ...spec, slots: slotDefs, wideSlots: isWide ? slotDefs : (spec.wideSlots ?? slotDefs) },
    isWide,
    currentCardSize,
  )

  const spread = scene === 'draw_stage'
    ? resolveDrawLayout(spreadId, slots, safeFrame, currentCardSize, spec.zIndexes)
    : resolveResultLayout(spreadId, slots, safeFrame, currentCardSize, headerHeight, spec.zIndexes)

  // In result_stage, the result_layout_resolver already handles vertical positioning.
  // We only apply the centering clamp for the draw_stage (to center cards in the stage).
  if (scene === 'draw_stage') {
    const halfSafeHeight = safeFrame.height / 2
    const envelopeFullSpanY = currentCardSize.height * spec.verticalSlots + (spec.verticalSlots - 1) * currentCardSize.gap
    const halfLayoutHeight = envelopeFullSpanY / 2
    const maxYOffset = Math.max(0, halfSafeHeight - halfLayoutHeight)
    const clampedCenterYOffset = Math.max(-maxYOffset, Math.min(maxYOffset, safeFrame.centerY))

    const mappedCards = spread.cards.map(card => ({
      ...card,
      y: card.y + clampedCenterYOffset,
    }))
    
    spread.cards = mappedCards
  }

  return {
    cards: spread.cards,
    stageShiftY: spread.stageShiftY,
    cardWidth: currentCardSize.width,
    cardHeight: currentCardSize.height,
    drawCardWidth: drawCardSize.width,
    drawCardHeight: drawCardSize.height,
    safeTopInset: safeFrame.y,
    safeBottomInset: safeFrame.bottomInset,
    safeSideInset: safeFrame.x,
    envelope: {
      cardWidth: currentCardSize.width,
      cardHeight: currentCardSize.height,
      gap: currentCardSize.gap,
      horizontalSlots: spec.horizontalSlots,
      verticalSlots: spec.verticalSlots,
      slotPitchX: currentCardSize.width + currentCardSize.gap,
      slotPitchY: currentCardSize.height + currentCardSize.gap,
      halfSpanX: ((spec.horizontalSlots - 1) * (currentCardSize.width + currentCardSize.gap)) / 2,
      halfSpanY: ((spec.verticalSlots - 1) * (currentCardSize.height + currentCardSize.gap)) / 2,
      fullSpanX: spec.horizontalSlots * currentCardSize.width + (spec.horizontalSlots - 1) * currentCardSize.gap,
      fullSpanY: spec.verticalSlots * currentCardSize.height + (spec.verticalSlots - 1) * currentCardSize.gap,
    },
  }
}

export { getBaseEnvelopeRequirement, getResultEnvelopeRequirement }

/** Badge overflow in px beyond card edge (12rpx). */
export function getBadgeOverflowPx(windowWidth: number): number {
  return Math.round((12 / 750) * windowWidth)
}

export { resolveMotionMetrics }
export type { MotionMetrics }
export { getSpreadCardCount }
