/**
 * Name: flows/divination/composables/use_animation_controller
 * Purpose: thin orchestrator — composes usePhases, usePlayback, usePresentation,
 *          useAnimationState, and useLifecycle into the animation controller public API.
 * Reason: isolates GSAP-dependent code so reading controller never touches animation internals.
 * Constraint: does NOT import any module under `reading/`.
 * Data flow: deps in → wires hooks via DI → exposes unified public API surface.
 */

import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import gsap from 'gsap'
import type { DrawCardState } from '../../shared/composables/animations/card_state'
import type { StyleReconciler } from '../../shared/composables/animations/style_sync'
import { useTarotStore } from '../../../core/store/tarot'
import { useThemeStore } from '../../../core/store/theme'
import overlayConfig from '../../../config.json'
import { useAnimationState } from '../../shared/composables/animations/use_animation_state'
import { useOverlayLayout } from '../../../core/sizing/overlay_layout/use_overlay_layout'
import { usePhases } from './use_phases'
import { usePlayback } from '../../shared/composables/animations/use_playback'
import { usePresentation } from './use_presentation'
import { useLifecycle } from './use_lifecycle'
import { killAnimationTargets } from '../../../core/gsap/tween'
import { calculatePhaseProgress } from './progress_model'
import { presentProgressHeader, presentFooter } from './progress_presenter'
import type { OverlayPhase } from '../../shared/composables/animations/contracts'
import { MAX_CARD_COUNT } from '../../shared/composables/animations/state'
import { MAX_CUT_PILES } from './phase_entry_snapshots'

/**
 * Delay between the draw landing and the auto-flip kick-off (ms).
 *
 * Per requirement N2 this is now 0 — the deal-stage already provides a
 * settle beat (alignment tween + per-card settle), so an additional
 * pre-flip pause is dead weight. Keep the constant in place so phase
 * builders that read it stay configurable, but ship with no extra wait.
 */
const AUTO_REVEAL_DELAY_MS = 0

const DECK_COUNT: number = (overlayConfig as { deckCount?: number }).deckCount ?? 12
const CUT_PILE_COUNT: number = Math.min(
  MAX_CUT_PILES,
  Math.max(1, (overlayConfig as { cutPileCount?: number }).cutPileCount ?? 3),
)
const CARDS_PER_PILE: number = Math.max(1, Math.floor(DECK_COUNT / CUT_PILE_COUNT))
const SHUFFLE_HALF_COUNT: number = Math.max(1, Math.floor(DECK_COUNT / 2))

export interface UseAnimationControllerCallbacks {
  onDrawingStart?: () => void
  onPipelineComplete: () => void
  onPhaseChange: (phase: OverlayPhase) => void
  onResetReading: () => void
  onDestroyReading: () => void
}

export interface UseAnimationControllerDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  callbacks: UseAnimationControllerCallbacks
}

/**
 * Style fields the controller passes through from the StyleReconciler.
 * Using Pick (not full `extends StyleReconciler`) because the controller
 * intentionally hides the internal `refresh*` methods (refreshBg / refreshStage
 * / refreshLefts / etc.) — only `refreshDraws` is part of the public surface
 * (consumed by DivinationDeck.vue when the layout reflows mid-pipeline).
 * Adding a new style ref to StyleReconciler still needs to be added here,
 * but the field shape (Ref<...>) stays in lockstep automatically.
 */
type ReconcilerPublic = Pick<StyleReconciler,
  | 'bgStyle' | 'stageStyle' | 'headerStyle' | 'footerStyle' | 'deckCtnStyle'
  | 'initialsStyle' | 'leftsStyle' | 'rightsStyle' | 'pilesStyle'
  | 'drawsStyle' | 'drawsSizeStyle' | 'innersStyle' | 'overlayVarsStyle'
  | 'layoutCardWidth' | 'layoutCardHeight'
  | 'refreshDraws' | 'setDrawCardSizes'
>

export interface UseAnimationControllerReturn extends ReconcilerPublic {
  phase: Ref<OverlayPhase>
  showResults: Ref<boolean>
  entryAnimationComplete: Ref<boolean>
  isPaused: Ref<boolean>
  playbackRate: Ref<number>
  cardsLanded: Ref<boolean>
  leftsVisible: Ref<boolean>
  rightsVisible: Ref<boolean>
  pilesVisible: Ref<boolean[]>
  drawsVisible: Ref<boolean[]>
  progressHeaderPresentation: ComputedRef<ReturnType<typeof presentProgressHeader>>
  footerPresentation: ComputedRef<ReturnType<typeof presentFooter>>
  phaseSteps: ComputedRef<ReturnType<typeof calculatePhaseProgress>>
  activePhaseIndex: ComputedRef<number>
  getSceneLayout: ReturnType<typeof useOverlayLayout>['getSceneLayout']
  checkWidth: ReturnType<typeof useOverlayLayout>['checkWidth']
  deckCount: number
  shuffleHalfCount: number
  cutPileCount: number
  cardsPerPile: number
  draws: DrawCardState[]
  refreshDraws: () => void
  setPlaybackRate: (rate: number) => void
  pauseAnimations: () => void
  resumeAnimations: () => void
  stepForward: () => void
  stepBackward: () => void
  seek: (position: number | string) => void
  replayFromPhase: (targetPhase: OverlayPhase) => void
  skipToReading: () => void
  resetOverlayScene: () => void
  start: () => void
  updateLayout: () => void
  openReadingPanel: () => void
  setDrawCardSizes: ReturnType<typeof useAnimationState>['setDrawCardSizes']
  clearTimeline: () => void
  killTimeline: () => void
  killAnimationTargets: () => void
  resetProgressModel: () => void
}

export function useAnimationController(deps: UseAnimationControllerDeps): UseAnimationControllerReturn {
  // Shared refs owned by this orchestrator — passed into hooks via DI
  const showResults = ref(false)
  const entryAnimationComplete = ref(false)
  const cardsLanded = ref(false)

  // ── Hook: phases + progress model ────────────────────────────────────
  const { phase, progressModel, transitionPhase } = usePhases()

  // ── Hook: playback controls + timeline orchestrator ───────────────────
  const {
    isPaused, playbackRate, orchestrator,
    setPlaybackRate, pauseAnimations, resumeAnimations,
    stepForward, stepBackward, seek,
    clearTimeline, killTimeline,
  } = usePlayback()

  // ── Hook: layout solver ───────────────────────────────────────────────
  const layoutApi = useOverlayLayout({
    isWide: deps.isWide,
    spreadKind: 'single_card',
    cutPileCount: CUT_PILE_COUNT,
    deckCount: DECK_COUNT,
  })

  // ── Hook: animation state + style reconciler ──────────────────────────
  const animState = useAnimationState({
    deckCount: DECK_COUNT,
    shuffleHalfCount: SHUFFLE_HALF_COUNT,
    maxCutPiles: MAX_CUT_PILES,
    maxCardCount: MAX_CARD_COUNT,
  })
  const {
    bg, stage, header, footer, deckCtn,
    initials, lefts, rights, piles, draws, inners,
    leftsVisible, rightsVisible, pilesVisible, drawsVisible,
    layoutCardWidth, layoutCardHeight,
    bgStyle, stageStyle, headerStyle, footerStyle, deckCtnStyle,
    initialsStyle, leftsStyle, rightsStyle, pilesStyle,
    drawsStyle, drawsSizeStyle, innersStyle,
    overlayVarsStyle,
    refreshBg, refreshStage, refreshHeader, refreshFooter, refreshDeckCtn,
    refreshInitials, refreshDraws,
    resetShuffleVisualState, resetCutVisualState, resetDrawVisualState, resetInitialDeckState,
    setDrawCardSizes,
    getAllTargets,
  } = animState

  // ── Hook: presentation computeds ─────────────────────────────────────
  const { progressHeaderPresentation, footerPresentation, phaseSteps, activePhaseIndex } =
    usePresentation({
      phase,
      showResults,
      getUiAsset: (name) => deps.themeStore.getUiAsset(name),
    })

  const { getSceneLayout, checkWidth } = layoutApi

  // ── Hook: lifecycle (entry settle, reset, interrupt, pipeline) ────────
  const lifecycle = useLifecycle({
    orchestrator,
    animState: {
      bg, stage, header, footer, deckCtn, initials, draws,
      refreshBg, refreshStage, refreshHeader, refreshFooter, refreshDeckCtn,
      refreshInitials, refreshDraws,
      resetInitialDeckState, resetShuffleVisualState, resetCutVisualState, resetDrawVisualState,
      setDrawCardSizes,
      getAllTargets,
    },
    showResults,
    cardsLanded,
    entryAnimationComplete,
    phase,
    progressModel,
    cardCount: deps.cardCount,
    getDeckCenter: () => layoutApi.getDeckCenter(),
    getOverlayLayouts: () => layoutApi.getOverlayLayouts(),
    getMotionMetrics: (s) => layoutApi.getMotionMetrics(s),
    getSceneLayout: (s) => layoutApi.getSceneLayout(s),
    cardElements: {
      initials, lefts, rights, piles,
      draws, inners, stage, deckCtn,
      bg, header, footer,
    },
    visible: { lefts: leftsVisible, rights: rightsVisible, piles: pilesVisible, draws: drawsVisible },
    deckCount: DECK_COUNT,
    cutPileCount: CUT_PILE_COUNT,
    autoRevealDelayMs: AUTO_REVEAL_DELAY_MS,
    transitionPhase,
    callbacks: {
      onPhaseChange: deps.callbacks.onPhaseChange,
      onPipelineComplete: deps.callbacks.onPipelineComplete,
      onDrawingStart: deps.callbacks.onDrawingStart,
      onResetReading: deps.callbacks.onResetReading,
      onDestroyReading: deps.callbacks.onDestroyReading,
    },
    resumeAnimations,
  })

  /* ── Layout helpers ───────────────────────────────────────────────── */

  function updateLayout() {
    const layout = getSceneLayout('draw_stage')
    setDrawCardSizes(layout)
    gsap.killTweensOf(draws)
    draws.forEach((draw, index) => {
      if (index >= layout.cards.length) return
      draw.x = layout.cards[index].x
      draw.y = layout.cards[index].y
    })
    refreshDraws()
  }

  function openReadingPanel() {
    if (showResults.value) return
    showResults.value = true
  }

  /* ── Return ───────────────────────────────────────────────────────── */

  return {
    phase, showResults, entryAnimationComplete,
    isPaused, playbackRate, cardsLanded,
    bgStyle, stageStyle, headerStyle, footerStyle, deckCtnStyle,
    initialsStyle, leftsStyle, rightsStyle, pilesStyle,
    drawsStyle, drawsSizeStyle, innersStyle,
    leftsVisible, rightsVisible, pilesVisible, drawsVisible,
    overlayVarsStyle, layoutCardWidth, layoutCardHeight,
    progressHeaderPresentation, footerPresentation, phaseSteps, activePhaseIndex,
    getSceneLayout, checkWidth,
    deckCount: DECK_COUNT, shuffleHalfCount: SHUFFLE_HALF_COUNT,
    cutPileCount: CUT_PILE_COUNT, cardsPerPile: CARDS_PER_PILE,
    draws, refreshDraws,
    setPlaybackRate, pauseAnimations, resumeAnimations,
    stepForward, stepBackward, seek,
    replayFromPhase: lifecycle.replayFromPhase,
    skipToReading: lifecycle.skipToReading,
    resetOverlayScene: lifecycle.resetOverlayScene,
    start: lifecycle.start,
    updateLayout, openReadingPanel,
    setDrawCardSizes,
    clearTimeline,
    killTimeline,
    killAnimationTargets: () => killAnimationTargets(getAllTargets()),
    resetProgressModel: () => progressModel.reset(),
  }
}
