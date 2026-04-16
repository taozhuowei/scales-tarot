/**
 * Name: spread_registry
 * Purpose: register built-in spread specs in data form and export lookup helpers.
 * Reason: built-in spreads should be data-driven so the generic solver can consume them.
 * Data flow: spread id flows in; spread spec (slots, envelope, optional resolver) flows out.
 */

import type { SpreadId, SpreadSpec, SpreadSlotSpec } from './spread_spec'
import {
  buildSingleCardLayout,
  buildThreeCardLayout,
  buildCrossSpreadLayout,
} from './built_in_layouts'

export const BUILT_IN_SPREADS: SpreadSpec[] = [
  {
    id: 'single_card',
    slots: [{ slotId: 'center', rx: 0, ry: 0 }],
    envelope: { horizontalSlots: 1, verticalSlots: 1 },
    resolveLayout: buildSingleCardLayout,
  },
  {
    id: 'three_card',
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
    envelope: { horizontalSlots: 3, verticalSlots: 3 },
    resolveLayout: buildThreeCardLayout,
  },
  {
    id: 'cross_spread',
    slots: [
      { slotId: 'center', rx: 0, ry: 0 },
      { slotId: 'north', rx: 0, ry: -1 },
      { slotId: 'south', rx: 0, ry: 1 },
      { slotId: 'west', rx: -1, ry: 0 },
      { slotId: 'east', rx: 1, ry: 0 },
    ],
    envelope: { horizontalSlots: 3, verticalSlots: 3 },
    resolveLayout: buildCrossSpreadLayout,
  },
]

const SPREAD_REGISTRY = new Map<string, SpreadSpec>(
  BUILT_IN_SPREADS.map(s => [s.id, s]),
)

export function getSpreadSpec(id: SpreadId): SpreadSpec | undefined {
  return SPREAD_REGISTRY.get(id)
}

export function registerSpread(spec: SpreadSpec): void {
  SPREAD_REGISTRY.set(spec.id, spec)
}

export function getSpreadSlots(id: SpreadId, isWide: boolean): SpreadSlotSpec[] {
  const spec = getSpreadSpec(id)
  if (!spec) return []
  return (isWide && spec.wideSlots?.length) ? spec.wideSlots : spec.slots
}

export function getSpreadCardCount(id: SpreadId): number {
  const spec = getSpreadSpec(id)
  if (!spec) return 0
  return spec.slots.length
}
