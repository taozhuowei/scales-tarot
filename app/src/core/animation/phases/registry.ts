/**
 * Name: animation/phases/registry
 * Purpose: define and manage overlay animation phases metadata + per-phase
 *          "snap-to-entry-state" helpers used by replay/skip flows.
 * Reason: centralise phase definitions so progress UI, orchestration, and the
 *          replay/skip commands stay in lock-step. The previous registry held
 *          only metadata; entry-state setup was duplicated across replay /
 *          skip commands and drifted from the actual phase builders. The
 *          manifest now owns the entry-state contract per phase.
 * Data flow: PHASE_MANIFEST is the single source of truth — PHASE_STEPS is a
 *          backward-compat projection for the progress UI; getPhaseSnap()
 *          looks up the entry-state setter for replay/skip dispatchers.
 */

import type { OverlayPhase, PhaseContext } from '../../flow/types'
import type { DrawCardState } from '../types'
import type { SceneLayout } from '../../sizing/layout_solver'
export type { OverlayPhase } from '../../flow/types'

/** Maximum number of cut piles the cut animation pre-allocates. */
export const MAX_CUT_PILES = 8

export interface PhaseStep {
  phase: OverlayPhase
  label: string
  activeIcon: string
  inactiveIcon: string
}

/**
 * Dependencies required by snapToEntryState helpers.
 *
 * The replay / skip commands construct one of these and pass it to the
 * matching snap helper; each helper writes the minimum shared visual state
 * its phase's builder *expects to see when run() is called*.
 *
 * Style refresh contract: the snap helpers mutate plain objects inside
 * `cardElements.lefts/rights/piles` and `draws`. The style reconciler
 * (createStyleReconciler) installs `watch(..., { deep: true })` on every
 * one of these arrays, so any field write is auto-picked-up on the next
 * tick — no explicit `refreshLefts/refreshRights/refreshPiles/refreshDraws`
 * call is required from the snap path. The replay command's `await
 * nextTick()` before `runPipelineFn` guarantees those reactive updates
 * have flushed to the DOM before phase builders read element refs.
 *
 * `setDrawCardSizes` is the one exception: it ALSO writes to `layoutCard*`
 * refs (not to `state.draws`), so it must be called explicitly when a snap
 * needs to set draw sizes (see snapToRevealingEntry).
 */
export interface PhaseSnapDeps {
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
  draws: DrawCardState[]
  deckGeometry: { centerX: number; centerY: number }
  drawLayout: SceneLayout
  cardCount: number
  cutPileCount: number
  shuffleSpreadX: number
  cutPileSpacing: number
  cutAxis: 'horizontal' | 'vertical'
  setDrawCardSizes(layout: SceneLayout): void
}

/**
 * PhaseManifest — single source of truth for both the progress-bar metadata
 * and the per-phase entry-state setter. Ordering of this array defines the
 * pipeline order (consumed by buildPhaseRunners / getPhaseOrder).
 */
export interface PhaseManifest {
  phase: OverlayPhase
  label: string
  activeIcon: string
  inactiveIcon: string
  snapToEntryState(deps: PhaseSnapDeps): void
}

/**
 * Snap to the cutting-phase entry visual state.
 *
 * NOT a strict mirror of shuffle's tail state: shuffling actually ends
 * with lefts/rights hidden (the merge atom collapses the two halves back
 * onto the deck and `visible.lefts/rights` flip false). But the cut
 * builder is written assuming the two halves are still visible and spread
 * apart — its first add() animates them inward to form the cut piles.
 * So when a dev replay drops in at `cutting`, we synthesise the "halves
 * spread, ready to be cut" entry state directly: visible + at the spread
 * X, regardless of what shuffling's actual exit state would have been.
 * This is a phase-builder contract, not a shuffle-tail contract.
 *
 * Invariants written:
 *   visible.lefts.value = true
 *   visible.rights.value = true
 *   lefts[i]  = (-spreadX, -i*0.8, rotation 0, scale 1, opacity 1)
 *   rights[i] = (+spreadX, -i*0.8, rotation 0, scale 1, opacity 1)
 *   initials remain at rest (resetOverlayScene set them).
 */
function snapToCuttingEntry(deps: PhaseSnapDeps): void {
  const { lefts, rights } = deps.cardElements
  deps.visible.lefts.value = true
  deps.visible.rights.value = true
  for (let i = 0; i < lefts.length; i++) {
    Object.assign(lefts[i], {
      x: -deps.shuffleSpreadX, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
    })
  }
  for (let i = 0; i < rights.length; i++) {
    Object.assign(rights[i], {
      x: deps.shuffleSpreadX, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
    })
  }
}

/**
 * Snap to the drawing-phase entry visual state.
 *
 * Cutting ended with N piles centred at rest (visible). The drawing builder
 * begins by lifting the stage and dealing draws[i] from the deck centre to
 * each target position; before run() is called the scene should show the
 * cut piles centred at their rest spacing (and lefts/rights hidden).
 *
 * Invariants written:
 *   visible.lefts.value = false
 *   visible.rights.value = false
 *   visible.piles.value[0..N-1] = true, rest false
 *   piles[i] positioned at (offset, 0) for horizontal axis or (0, offset)
 *           for vertical axis, where offset = (i - (N-1)/2) * cutPileSpacing
 *   draws stay hidden (drawing builder will show them as it deals).
 */
function snapToDrawingEntry(deps: PhaseSnapDeps): void {
  const { piles } = deps.cardElements
  const N = Math.max(1, deps.cutPileCount)

  deps.visible.lefts.value = false
  deps.visible.rights.value = false

  const pilesVisible = Array.from({ length: MAX_CUT_PILES }, () => false)
  for (let i = 0; i < N; i++) {
    const offset = (i - (N - 1) / 2) * deps.cutPileSpacing
    const x = deps.cutAxis === 'horizontal' ? offset : 0
    const y = deps.cutAxis === 'horizontal' ? 0 : offset
    Object.assign(piles[i], { x, y, rotation: 0, scale: 1, opacity: 1, zIndex: 20 - i })
    pilesVisible[i] = true
  }
  deps.visible.piles.value = pilesVisible
}

/**
 * Snap to the revealing-phase entry visual state.
 *
 * Drawing ended with all draws[i] landed at their final draw-stage targets,
 * face-down, sized to drawCardWidth × drawCardHeight. The reveal builder's
 * first add() sets the same state but we must guarantee size + position
 * before its growAtom can interpolate from. We also hide unused draws and
 * piles to clean up any residual visuals from a partial replay.
 *
 * Invariants written:
 *   visible.draws.value[i] = true for i < cardCount, false otherwise
 *   visible.piles.value[*] = false
 *   draws[i] = (drawLayout.cards[i].x/y, rotation 0, scale 1, opacity 1,
 *              width drawCardWidth, height drawCardHeight, zIndex 20 - i)
 *   draws.width/height honour the layout via setDrawCardSizes(drawLayout)
 *   inners[i].rotationY left at 0 (reveal flips them).
 */
function snapToRevealingEntry(deps: PhaseSnapDeps): void {
  deps.setDrawCardSizes(deps.drawLayout)
  const { draws } = deps
  const cardCount = deps.cardCount
  const drawsVisible = Array.from({ length: draws.length }, () => false)

  for (let i = 0; i < cardCount; i++) {
    const target = deps.drawLayout.cards[i]
    if (!target) continue
    Object.assign(draws[i], {
      x: target.x,
      y: target.y,
      rotation: 0,
      scale: 1,
      opacity: 1,
      zIndex: 20 - i,
      width: deps.drawLayout.drawCardWidth,
      height: deps.drawLayout.drawCardHeight,
    })
    drawsVisible[i] = true
  }
  for (let i = cardCount; i < draws.length; i++) {
    draws[i].opacity = 0
    drawsVisible[i] = false
  }
  deps.visible.draws.value = drawsVisible
  deps.visible.piles.value = Array.from({ length: MAX_CUT_PILES }, () => false)
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
