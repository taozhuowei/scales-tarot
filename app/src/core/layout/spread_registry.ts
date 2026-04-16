/**
 * Name: core/layout/spread_registry
 * Purpose: register built-in spread metadata and export lookup helpers.
 * Reason: built-in spreads should be data-driven so the layout calculator can consume them.
 * Data flow: spread id flows in; spread spec (slots, envelope, optional resolver) flows out.
 */

import type { SpreadSpec, SpreadSlotDef } from './types'

export const BUILT_IN_SPREADS: SpreadSpec[] = [
  {
    id: 'single_card',
    name: '单张牌',
    slotCount: 1,
    horizontalSlots: 1,
    verticalSlots: 1,
    slots: [{ slotId: 'center', rx: 0, ry: 0 }],
    slotResolver: 'single_card',
  },
  {
    id: 'three_card',
    name: '三张牌',
    slotCount: 3,
    horizontalSlots: 3,
    verticalSlots: 3,
    slots: [
      { slotId: 'past', rx: 0, ry: 1 },
      { slotId: 'present', rx: 0, ry: 0 },
      { slotId: 'future', rx: 0, ry: -1 },
    ],
    wideSlots: [
      { slotId: 'past', rx: -1, ry: 0 },
      { slotId: 'present', rx: 0, ry: 0 },
      { slotId: 'future', rx: 1, ry: 0 },
    ],
    slotResolver: 'three_card',
  },
  {
    id: 'cross_spread',
    name: '十字牌阵',
    slotCount: 5,
    horizontalSlots: 3,
    verticalSlots: 3,
    slots: [
      { slotId: 'center', rx: 0, ry: 0 },
      { slotId: 'north', rx: 0, ry: -1 },
      { slotId: 'south', rx: 0, ry: 1 },
      { slotId: 'west', rx: -1, ry: 0 },
      { slotId: 'east', rx: 1, ry: 0 },
    ],
    slotResolver: 'cross_spread',
  },
]

const SPREAD_REGISTRY = new Map<string, SpreadSpec>(
  BUILT_IN_SPREADS.map(s => [s.id, s]),
)

export function resolveSpreadSpec(spreadId: string, _isWide: boolean): SpreadSpec {
  const spec = SPREAD_REGISTRY.get(spreadId)
  if (!spec) {
    return {
      id: spreadId,
      name: spreadId,
      slotCount: 3,
      horizontalSlots: 3,
      verticalSlots: 3,
      slots: [],
    }
  }
  return spec
}

export function getSpreadSlots(spreadId: string, isWide: boolean): SpreadSlotDef[] {
  const spec = resolveSpreadSpec(spreadId, isWide)
  return (isWide && spec.wideSlots?.length) ? spec.wideSlots : spec.slots
}

export function getSpreadCardCount(spreadId: string): number {
  const spec = SPREAD_REGISTRY.get(spreadId)
  return spec?.slotCount ?? 0
}
