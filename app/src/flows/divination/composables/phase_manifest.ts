/**
 * Name: flows/divination/composables/phase_manifest
 * Purpose: single source of truth for phase ordering + metadata
 *          (PHASE_MANIFEST), its backward-compat progress-UI projection
 *          (PHASE_STEPS), and the derived lookup / sequence helpers.
 * Reason: split out of registry.ts so the manifest data + queries are one
 *          module; binds the replay snap helpers via
 *          PHASE_MANIFEST.snapToEntryState.
 * Data flow: PHASE_MANIFEST is the single source of truth — PHASE_STEPS is a
 *          backward-compat projection for the progress UI; getPhaseSnap()
 *          looks up the entry-state setter for replay/skip dispatchers.
 */

import type { OverlayPhase } from '../../shared/composables/animations/contracts'
import type { PhaseSnapDeps } from './phase_entry_snapshots'
import {
  snapToCuttingEntry,
  snapToDrawingEntry,
  snapToRevealingEntry,
} from './phase_entry_snapshots'

/**
 * Progress-bar metadata for one phase. Absorbed verbatim from the former
 * phase_types during the flows refactor.
 */
export interface PhaseStep {
  phase: OverlayPhase
  label: string
  activeIcon: string
  inactiveIcon: string
}

/**
 * PhaseManifest — single source of truth for both the progress-bar metadata
 * and the per-phase entry-state setter. Ordering of this array defines the
 * pipeline order (consumed by buildPhaseRunners / getPhaseOrder). Absorbed
 * verbatim from the former phase_types during the flows refactor.
 */
export interface PhaseManifest {
  phase: OverlayPhase
  label: string
  activeIcon: string
  inactiveIcon: string
  snapToEntryState(deps: PhaseSnapDeps): void
}

/**
 * Single source of truth for phase ordering and metadata. The pipeline
 * builder, progress UI, and replay/skip commands all derive from this.
 */
export const PHASE_MANIFEST: PhaseManifest[] = [
  {
    phase: 'shuffling',
    label: '洗牌',
    activeIcon: 'icon_wands',
    inactiveIcon: 'icon_wands_inactive',
    // Shuffling is the first phase; resetOverlayScene already produces its
    // entry state, so no additional snap is needed.
    snapToEntryState: () => { /* no-op: reset already in place */ },
  },
  {
    phase: 'cutting',
    label: '切牌',
    activeIcon: 'icon_swords',
    inactiveIcon: 'icon_swords_inactive',
    snapToEntryState: (deps) => snapToCuttingEntry(deps),
  },
  {
    phase: 'drawing',
    label: '抽牌',
    activeIcon: 'icon_cups',
    inactiveIcon: 'icon_cups_inactive',
    snapToEntryState: (deps) => snapToDrawingEntry(deps),
  },
  {
    phase: 'revealing',
    label: '翻牌',
    activeIcon: 'icon_pentacles',
    inactiveIcon: 'icon_pentacles_inactive',
    snapToEntryState: (deps) => snapToRevealingEntry(deps),
  },
]

/**
 * Backward-compat projection — PHASE_STEPS keeps the old shape so existing
 * progress-UI consumers (phase_progress_presenter, phase_progress_model) need
 * no changes when the manifest gains new fields.
 */
export const PHASE_STEPS: PhaseStep[] = PHASE_MANIFEST.map(
  ({ phase, label, activeIcon, inactiveIcon }) => ({ phase, label, activeIcon, inactiveIcon }),
)

export function getPhaseIndex(phase: OverlayPhase): number {
  return PHASE_MANIFEST.findIndex((s) => s.phase === phase)
}

export function getPhaseStep(phase: OverlayPhase): PhaseStep | undefined {
  return PHASE_STEPS.find((s) => s.phase === phase)
}

export function isValidPhase(phase: string): phase is OverlayPhase {
  return PHASE_MANIFEST.some((s) => s.phase === phase)
}

export function getPhaseSteps(): PhaseStep[] {
  return PHASE_STEPS
}

export function getNextPhase(phase: OverlayPhase): OverlayPhase | null {
  const index = getPhaseIndex(phase)
  if (index < 0 || index >= PHASE_MANIFEST.length - 1) {
    return null
  }
  return PHASE_MANIFEST[index + 1].phase
}

/**
 * Phase ordering derived from the manifest — used by the pipeline builder
 * and any caller that needs the canonical sequence as plain phase names.
 */
export function getPhaseOrder(): OverlayPhase[] {
  return PHASE_MANIFEST.map((m) => m.phase)
}

/**
 * Lookup helper for the snap-to-entry-state setter for a given phase.
 * Returns a no-op for phases that don't need explicit setup (shuffling),
 * so callers don't need to special-case the first phase.
 */
export function getPhaseSnap(phase: OverlayPhase): (deps: PhaseSnapDeps) => void {
  const entry = PHASE_MANIFEST.find((m) => m.phase === phase)
  return entry ? entry.snapToEntryState : () => { /* unknown phase: no-op */ }
}
