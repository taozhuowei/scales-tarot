/**
 * Name: core/layout/card_position_calculator
 * Purpose: shared coordinate conversion and clamping utilities for layout resolvers.
 * Reason: avoid duplicating math between draw and result resolvers.
 */

import type { SafeFrame } from '../viewport/types'
import type { CardSize } from '../sizing/types'
import type { SpreadSlot, CardLayout } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function toCardLayout(
  slot: SpreadSlot,
  cardSize: CardSize,
  zIndex: number,
): CardLayout {
  return {
    slotId: slot.slotId,
    x: slot.x,
    y: slot.y,
    width: cardSize.width,
    height: cardSize.height,
    rotateDeg: 0,
    zIndex,
  }
}

export function resolveAbsolutePosition(
  slot: SpreadSlot,
  safeFrame: SafeFrame,
): { x: number; y: number } {
  return {
    x: slot.x + safeFrame.centerX,
    y: slot.y + safeFrame.centerY,
  }
}
