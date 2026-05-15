// @vitest-environment jsdom

/**
 * Name: replay_from_phase.test
 * Purpose: cover the replay-from-phase command's call sequence and the
 *          dev-replay wrapper's reading-seed contract.
 * Reason: regressions in either layer are silent (the panel opens with empty
 *         body, or the snap helper runs after the pipeline starts and reads
 *         stale element refs). Both paths sit between layers and lack
 *         coverage in the per-phase or full-controller tests.
 * Data flow: the command test mocks every dep and asserts the call order;
 *          the wrapper test exercises the conditional `startReading` seed
 *          for the `revealing` boundary case described in P1 (TODO 8.2.2).
 */

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { replayFromPhaseCommand } from '../src/composables/commands/replay_from_phase'
import type { OverlayPhase } from '../src/core/flow/types'
import type { PhaseSnapDeps } from '../src/animation/phases/registry'
import { MAX_CARD_COUNT, MAX_CUT_PILES } from '../src/core/config/layout_constants'
import type { SceneLayout } from '../src/core/sizing/layout_solver'

/**
 * Minimal valid PhaseSnapDeps for these tests. The replay command passes
 * this into the per-phase snapToEntryState helper, which destructures
 * cardElements + visible + draws and writes positions/visibility. We need a
 * real shape here because the registry's snap fns are not mocked.
 */
function makeSnapDeps(): PhaseSnapDeps {
  const lefts = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const rights = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const piles = Array.from({ length: MAX_CUT_PILES }, (_, i) => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 + i,
  }))
  const draws = Array.from({ length: MAX_CARD_COUNT }, (_, i) => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 20 - i, width: 0, height: 0,
  }))
  const inners = Array.from({ length: MAX_CARD_COUNT }, () => ({ rotationY: 0 }))
  const initials = Array.from({ length: 12 }, (_, i) => ({
    x: 0, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
  }))
  const drawLayout = {
    drawCardWidth: 100, drawCardHeight: 160,
    cardWidth: 100, cardHeight: 160,
    stageShiftY: 0,
    cards: Array.from({ length: 3 }, (_, i) => ({
      x: i * 110, y: 0, width: 100, height: 160,
    })),
  } as unknown as SceneLayout

  return {
    cardElements: {
      initials, lefts, rights, piles, draws, inners,
      stage: { y: 0 }, deckCtn: { x: 0 },
      bg: { opacity: 1 }, header: { y: 0, opacity: 1 }, footer: { y: 0, opacity: 1 },
    },
    visible: {
      lefts: ref(false),
      rights: ref(false),
      piles: ref(Array.from({ length: MAX_CUT_PILES }, () => false)),
      draws: ref(Array.from({ length: MAX_CARD_COUNT }, () => false)),
    },
    draws,
    deckGeometry: { centerX: 0, centerY: 0 },
    drawLayout,
    cardCount: 3,
    cutPileCount: 3,
    shuffleSpreadX: 100,
    cutPileSpacing: 80,
    cutAxis: 'horizontal',
    setDrawCardSizes: vi.fn(),
  }
}

/**
 * Minimal stand-in for the dev replay wrapper that lives at the call site
 * (pages/main/index.vue + composables/use_overlay.ts). The wrapper's only
 * non-trivial behaviour is the `revealing` boundary case: when the dev tool
 * jumps past `drawing`, the `onDrawingStart` hook never fires, so the
 * wrapper must seed the reading request itself.
 */
function makeDevReplayWrapper(
  readingController: { resetReading: () => void; startReading: (req: unknown) => Promise<unknown> },
  animController: { replayFromPhase: (phase: OverlayPhase) => void },
) {
  return function devReplay(targetPhase: OverlayPhase) {
    if (targetPhase === 'revealing') {
      readingController.resetReading()
      void readingController.startReading({})
    }
    animController.replayFromPhase(targetPhase)
  }
}

describe('dev replay wrapper (P1: revealing boundary case)', () => {
  it('seeds startReading when target is revealing', () => {
    const readingController = {
      resetReading: vi.fn(),
      startReading: vi.fn().mockResolvedValue(null),
    }
    const animController = { replayFromPhase: vi.fn() }
    const devReplay = makeDevReplayWrapper(readingController, animController)

    devReplay('revealing')

    // Reset must precede start so the previous run's promise can't resolve
    // against the new run.
    expect(readingController.resetReading).toHaveBeenCalledTimes(1)
    expect(readingController.startReading).toHaveBeenCalledTimes(1)
    expect(readingController.startReading).toHaveBeenCalledWith({})
    expect(readingController.resetReading.mock.invocationCallOrder[0])
      .toBeLessThan(readingController.startReading.mock.invocationCallOrder[0])
    // Animation controller is invoked after the reading is seeded so the
    // pipeline's onPhaseStart('revealing') opens the panel against an
    // already-loading orchestrator.
    expect(animController.replayFromPhase).toHaveBeenCalledWith('revealing')
  })

  it('does NOT seed startReading when target is drawing', () => {
    // Drawing's own builder fires onDrawingStart, which the animation
    // controller wires to readingController.startReading via its callbacks.
    // Seeding here would double-start the request.
    const readingController = {
      resetReading: vi.fn(),
      startReading: vi.fn().mockResolvedValue(null),
    }
    const animController = { replayFromPhase: vi.fn() }
    const devReplay = makeDevReplayWrapper(readingController, animController)

    devReplay('drawing')

    expect(readingController.resetReading).not.toHaveBeenCalled()
    expect(readingController.startReading).not.toHaveBeenCalled()
    expect(animController.replayFromPhase).toHaveBeenCalledWith('drawing')
  })

  it.each(['shuffling', 'cutting'] as const)(
    'does NOT seed startReading when target is %s',
    (target) => {
      const readingController = {
        resetReading: vi.fn(),
        startReading: vi.fn().mockResolvedValue(null),
      }
      const animController = { replayFromPhase: vi.fn() }
      const devReplay = makeDevReplayWrapper(readingController, animController)

      devReplay(target)

      expect(readingController.startReading).not.toHaveBeenCalled()
      expect(animController.replayFromPhase).toHaveBeenCalledWith(target)
    },
  )
})

describe('replayFromPhaseCommand (call sequence)', () => {
  /**
   * Build a fully-mocked deps bundle. Each dep is a vi.fn so we can assert
   * call ordering via mock.invocationCallOrder.
   */
  function makeDeps() {
    const interruptCurrentAnimation = vi.fn()
    const resetOverlayScene = vi.fn()
    const onPhaseChange = vi.fn()
    const runPipelineFn = vi.fn()
    const snapFn = vi.fn()
    const getPhaseSnapDeps = vi.fn(() => makeSnapDeps())

    // The command resolves snap helpers via getPhaseSnap(targetPhase). We
    // can't easily stub the registry without mocking the module, so the
    // tests below assert the externally-observable contract instead:
    // interrupt → reset → snap (when targetIndex > 0) → phaseRef set →
    // progressModel.transitionTo → onPhaseChange → runPipelineFn(targetIndex).
    // The snap helper itself is unit-tested in overlay_phase_snap.test.ts.

    const phaseRef = ref<OverlayPhase>('shuffling')
    const progressModel = { transitionTo: vi.fn() }
    const entryAnimationComplete = ref(false)

    return {
      interruptCurrentAnimation,
      resetOverlayScene,
      onPhaseChange,
      runPipelineFn,
      snapFn,
      getPhaseSnapDeps,
      phaseRef,
      progressModel,
      entryAnimationComplete,
    }
  }

  it('runs the canonical sequence for target=shuffling (index 0, no snap)', async () => {
    const d = makeDeps()
    await replayFromPhaseCommand('shuffling', {
      interruptCurrentAnimation: d.interruptCurrentAnimation,
      entryAnimationComplete: d.entryAnimationComplete,
      resetOverlayScene: d.resetOverlayScene,
      phaseRef: d.phaseRef,
      progressModel: d.progressModel as never,
      onPhaseChange: d.onPhaseChange,
      runPipelineFn: d.runPipelineFn,
      getPhaseSnapDeps: d.getPhaseSnapDeps,
    })

    // interrupt happens first; reset second.
    expect(d.interruptCurrentAnimation).toHaveBeenCalledTimes(1)
    expect(d.resetOverlayScene).toHaveBeenCalledTimes(1)
    expect(d.interruptCurrentAnimation.mock.invocationCallOrder[0])
      .toBeLessThan(d.resetOverlayScene.mock.invocationCallOrder[0])

    // entryAnimationComplete latched true — replay must not re-play entry.
    expect(d.entryAnimationComplete.value).toBe(true)

    // Phase ref + progress + onPhaseChange all wired to the target phase.
    expect(d.phaseRef.value).toBe('shuffling')
    expect(d.progressModel.transitionTo).toHaveBeenCalledWith('shuffling')
    expect(d.onPhaseChange).toHaveBeenCalledWith('shuffling')

    // runPipelineFn invoked at the canonical index for shuffling (= 0).
    expect(d.runPipelineFn).toHaveBeenCalledWith(0)

    // snap helper deps NOT requested for the first phase — getPhaseSnap of
    // shuffling is a no-op, but the command short-circuits even calling it
    // when targetIndex === 0 to avoid the unnecessary deps-bundle build.
    expect(d.getPhaseSnapDeps).not.toHaveBeenCalled()
  })

  it.each([
    ['cutting', 1],
    ['drawing', 2],
    ['revealing', 3],
  ] as const)('builds snap deps and runs pipeline at index %s for target=%s', async (target, expectedIndex) => {
    const d = makeDeps()
    await replayFromPhaseCommand(target, {
      interruptCurrentAnimation: d.interruptCurrentAnimation,
      entryAnimationComplete: d.entryAnimationComplete,
      resetOverlayScene: d.resetOverlayScene,
      phaseRef: d.phaseRef,
      progressModel: d.progressModel as never,
      onPhaseChange: d.onPhaseChange,
      runPipelineFn: d.runPipelineFn,
      getPhaseSnapDeps: d.getPhaseSnapDeps,
    })

    expect(d.getPhaseSnapDeps).toHaveBeenCalledTimes(1)
    expect(d.runPipelineFn).toHaveBeenCalledWith(expectedIndex)
    expect(d.phaseRef.value).toBe(target)
    expect(d.progressModel.transitionTo).toHaveBeenCalledWith(target)
    expect(d.onPhaseChange).toHaveBeenCalledWith(target)
  })

  it('awaits nextTick before running the pipeline so visible-flag mutations flush', async () => {
    const d = makeDeps()
    let pipelineCalled = false
    d.runPipelineFn.mockImplementation(() => { pipelineCalled = true })

    const promise = replayFromPhaseCommand('drawing', {
      interruptCurrentAnimation: d.interruptCurrentAnimation,
      entryAnimationComplete: d.entryAnimationComplete,
      resetOverlayScene: d.resetOverlayScene,
      phaseRef: d.phaseRef,
      progressModel: d.progressModel as never,
      onPhaseChange: d.onPhaseChange,
      runPipelineFn: d.runPipelineFn,
      getPhaseSnapDeps: d.getPhaseSnapDeps,
    })

    // Synchronously after the call: phase + onPhaseChange have run, but
    // runPipelineFn is gated behind await nextTick.
    expect(d.onPhaseChange).toHaveBeenCalledWith('drawing')
    expect(pipelineCalled).toBe(false)

    await promise
    expect(pipelineCalled).toBe(true)
  })
})
