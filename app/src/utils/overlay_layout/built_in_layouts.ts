/**
 * Name: built_in_layouts (compatibility shim)
 * Purpose: delegates to the new core layout resolvers (draw_layout_resolver and result_layout_resolver).
 * TODO: migrate all consumers to core/layout/draw_layout_resolver and core/layout/result_layout_resolver.
 */

import type {
  CardEnvelope,
  SpreadCardLayout,
  SpreadLayoutContext,
  SpreadLayoutResult,
} from './spread_spec'
import { resolveDrawLayout } from '../../core/layout/draw_layout_resolver'
import { resolveResultLayout } from '../../core/layout/result_layout_resolver'
import { resolveSpreadSlots } from '../../core/layout/spread_layout_calculator'
import type { SpreadSpec as CoreSpreadSpec, SpreadSlot } from '../../core/layout/types'
import { resolveSpreadSpec } from '../../core/layout/spread_registry'
import type { CardSize } from '../../core/sizing/types'
import type { SafeFrame } from '../../core/viewport/types'

function toCardSize(envelope: CardEnvelope): CardSize {
  return {
    width: envelope.cardWidth,
    height: envelope.cardHeight,
    gap: envelope.gap,
  }
}

function toSafeFrame(ctx: SpreadLayoutContext): SafeFrame {
  // The legacy context does not carry full safe frame.
  // We approximate a safe frame centered at (0, 0).
  const halfSpanX = ctx.envelope.fullSpanX / 2
  const halfSpanY = ctx.envelope.fullSpanY / 2
  return {
    x: 0,
    y: 0,
    width: halfSpanX * 2,
    height: halfSpanY * 2,
    centerX: 0,
    centerY: 0,
    bottomInset: 0,
  }
}

function toCoreSpec(spreadId: string, isWide: boolean): CoreSpreadSpec {
  return resolveSpreadSpec(spreadId, isWide)
}

function fromDrawResult(result: import('../../core/layout/draw_layout_resolver').DrawLayoutResult, cardSize: CardSize): SpreadLayoutResult {
  return {
    cardWidth: cardSize.width,
    cardHeight: cardSize.height,
    stageShiftY: result.stageShiftY,
    cards: result.cards.map(c => ({
      slotId: c.slotId,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      rotateDeg: c.rotateDeg,
      zIndex: c.zIndex,
    })),
  }
}

function fromResultResult(result: import('../../core/layout/result_layout_resolver').ResultLayoutResult, cardSize: CardSize): SpreadLayoutResult {
  return {
    cardWidth: cardSize.width,
    cardHeight: cardSize.height,
    stageShiftY: result.stageShiftY,
    cards: result.cards.map(c => ({
      slotId: c.slotId,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      rotateDeg: c.rotateDeg,
      zIndex: c.zIndex,
    })),
  }
}

function resolveLayout(
  spreadId: string,
  ctx: SpreadLayoutContext,
): SpreadLayoutResult {
  const { scene, isWide, envelope, headerHeight } = ctx
  const coreSpec = toCoreSpec(spreadId, isWide)
  const cardSize = toCardSize(envelope)
  const safeFrame = toSafeContext(ctx)
  const slots: SpreadSlot[] = resolveSpreadSlots(coreSpec, isWide, cardSize)

  if (scene === 'draw_stage') {
    const drawResult = resolveDrawLayout(spreadId, slots, safeFrame, cardSize, headerHeight)
    return fromDrawResult(drawResult, cardSize)
  }

  const resultResult = resolveResultLayout(spreadId, slots, safeFrame, cardSize, headerHeight)
  return fromResultResult(resultResult, cardSize)
}

function toSafeContext(ctx: SpreadLayoutContext): SafeFrame {
  // Approximate safe frame from context values used by legacy solvers.
  const { containerWidth, containerHeight } = ctx
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

export function buildSingleCardLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  return resolveLayout('single_card', ctx)
}

export function buildThreeCardLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  return resolveLayout('three_card', ctx)
}

export function buildCrossSpreadLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  return resolveLayout('cross_spread', ctx)
}
