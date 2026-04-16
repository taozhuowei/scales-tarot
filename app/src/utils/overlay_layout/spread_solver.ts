/**
 * Name: spread_solver (compatibility shim)
 * Purpose: backward-compatible re-export of spread layout solving.
 * TODO: migrate all consumers to core/layout/draw_layout_resolver and result_layout_resolver.
 */

import type {
  SpreadId,
  SpreadScene,
  CardEnvelope,
  SpreadLayoutResult,
  SpreadCardLayout,
} from './spread_spec'
export type { SpreadLayoutResult, SpreadCardLayout } from './spread_spec'

import { resolveDrawLayout } from '../../core/layout/draw_layout_resolver'
import { resolveResultLayout } from '../../core/layout/result_layout_resolver'
import { resolveSpreadSlots } from '../../core/layout/spread_layout_calculator'
import { resolveSpreadSpec } from '../../core/layout/spread_registry'
import type { SpreadSlot } from '../../core/layout/types'
import type { CardSize } from '../../core/sizing/types'
import type { SafeFrame } from '../../core/viewport/types'

function toCardSize(envelope: CardEnvelope): CardSize {
  return {
    width: envelope.cardWidth,
    height: envelope.cardHeight,
    gap: envelope.gap,
  }
}

function toSafeFrame(containerWidth: number, containerHeight: number): SafeFrame {
  return {
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight,
    centerX: 0,
    centerY: 0,
    bottomInset: 0,
  }
}

export interface SpreadSolverInput {
  spreadId: SpreadId
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  envelope: CardEnvelope
  headerHeight?: number
}

export function resolveSpreadLayout(input: SpreadSolverInput): SpreadLayoutResult {
  const { spreadId, scene, containerWidth, containerHeight, isWide, envelope, headerHeight } = input
  const coreSpec = resolveSpreadSpec(spreadId, isWide)
  const cardSize = toCardSize(envelope)
  const slots: SpreadSlot[] = resolveSpreadSlots(coreSpec, isWide, cardSize)
  const safeFrame = toSafeFrame(containerWidth, containerHeight)

  if (scene === 'draw_stage') {
    const drawResult = resolveDrawLayout(spreadId, slots, safeFrame, cardSize, headerHeight)
    return {
      cardWidth: cardSize.width,
      cardHeight: cardSize.height,
      stageShiftY: drawResult.stageShiftY,
      cards: drawResult.cards,
    }
  }

  const resultResult = resolveResultLayout(spreadId, slots, safeFrame, cardSize, headerHeight)
  return {
    cardWidth: cardSize.width,
    cardHeight: cardSize.height,
    stageShiftY: resultResult.stageShiftY,
    cards: resultResult.cards,
  }
}
