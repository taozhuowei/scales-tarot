/**
 * Name: spread_registry (compatibility shim)
 * Purpose: backward-compatible re-export of the core layout spread registry.
 * TODO: migrate all consumers to core/layout/spread_registry and delete this file.
 */

import type { SpreadId, SpreadSpec, SpreadSlotSpec } from './spread_spec'
import {
  resolveSpreadSpec as resolveCoreSpreadSpec,
  getSpreadSlots as getCoreSpreadSlots,
  getSpreadCardCount as getCoreSpreadCardCount,
} from '../../core/layout/spread_registry'
import type { SpreadSpec as CoreSpreadSpec, SpreadSlotDef } from '../../core/layout/types'

const CORE_TO_LEGACY_REGISTRY = new Map<string, SpreadSpec>()

function toLegacySpec(core: CoreSpreadSpec): SpreadSpec {
  return {
    id: core.id as SpreadId,
    slots: core.slots.map(s => ({ slotId: s.slotId, rx: s.rx, ry: s.ry })),
    wideSlots: core.wideSlots?.map(s => ({ slotId: s.slotId, rx: s.rx, ry: s.ry })),
    envelope: {
      horizontalSlots: core.horizontalSlots,
      verticalSlots: core.verticalSlots,
    },
  }
}

function ensureRegistered(core: CoreSpreadSpec): SpreadSpec {
  const existing = CORE_TO_LEGACY_REGISTRY.get(core.id)
  if (existing) return existing
  const legacy = toLegacySpec(core)
  CORE_TO_LEGACY_REGISTRY.set(core.id, legacy)
  return legacy
}

export const BUILT_IN_SPREADS: SpreadSpec[] = [
  ensureRegistered(resolveCoreSpreadSpec('single_card', false)),
  ensureRegistered(resolveCoreSpreadSpec('three_card', false)),
  ensureRegistered(resolveCoreSpreadSpec('cross_spread', false)),
]

export function getSpreadSpec(id: SpreadId): SpreadSpec | undefined {
  const core = resolveCoreSpreadSpec(id, false)
  if (!core || core.slots.length === 0) return undefined
  return ensureRegistered(core)
}

export function registerSpread(spec: SpreadSpec): void {
  CORE_TO_LEGACY_REGISTRY.set(spec.id, spec)
}

export function getSpreadSlots(id: SpreadId, isWide: boolean): SpreadSlotSpec[] {
  const coreSlots: SpreadSlotDef[] = getCoreSpreadSlots(id, isWide)
  return coreSlots.map(s => ({ slotId: s.slotId, rx: s.rx, ry: s.ry }))
}

export function getSpreadCardCount(id: SpreadId): number {
  return getCoreSpreadCardCount(id)
}
