/**
 * Name: flows/divination/composables/phases/reveal
 * Purpose: revealing phase = compose growAtom (resize cards to result size)
 *          + flipAtom (rotate inners 0→180 to show face). Per design rule
 *          "card already enlarged before flipping": grow runs first, flip
 *          runs after grow completes.
 * Reason: previously the flip ran in the drawing phase on small face-down
 *          cards (incongruent with the design rule) and the reveal phase
 *          only resized. Atomising into growAtom + flipAtom and moving the
 *          flip here makes the cards visibly enlarge before flipping.
 * Data flow: phase entry resets draws to initial position+size+visibility,
 *          then growAtom + flipAtom compose into the timeline.
 */
import gsap from 'gsap'
import type { AnimationTimeline } from '../../../shared/composables/animations/card_state'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../shared/composables/animations/contracts'
import { growAtom } from '../../../shared/composables/animations/grow'
import { flipAtom } from '../../../shared/composables/animations/flip'

export interface RevealPhaseConfig {
  cardCount: number
  drawCardWidth: number
  drawCardHeight: number
  resultCardWidth: number
  resultCardHeight: number
  drawLayout: {
    stageShiftY: number
    cards: { x: number; y: number }[]
  }
}

/**
 * Reset the draws array to the phase entry state (draw-stage position +
 * size + visibility). Cards beyond `cardCount` are hidden so a previous
 * spread with more cards leaves no stragglers behind.
 *
 * scale stays 1 — size is encoded in width/height so the grow atom can
 * tween it without compounding with a transform scale.
 */
function resetDrawsToEntryState(
  context: PhaseContext,
  config: RevealPhaseConfig,
): void {
  const { draws } = context.cardElements
  const { draws: drawsVisible } = context.visible
  const {
    cardCount,
    drawLayout,
    drawCardWidth,
    drawCardHeight,
  } = config
  const targetX = drawLayout.cards.map((c) => c.x)
  const targetY = drawLayout.cards.map((c) => c.y)

  const visible = [...drawsVisible.value]
  draws.forEach((state, index) => {
    if (index < cardCount) {
      Object.assign(state, {
        x: targetX[index],
        y: targetY[index],
        rotation: 0,
        scale: 1,
        opacity: 1,
        zIndex: 20 - index,
        width: drawCardWidth,
        height: drawCardHeight,
      })
      visible[index] = true
    } else {
      state.opacity = 0
      visible[index] = false
    }
  })
  drawsVisible.value = visible
}

/**
 * Compose the reveal timeline: phase entry reset → growAtom → flipAtom.
 *
 * Atom 1 (`growAtom`): resize cards from draw size to result size. The
 * `+=0.1` offset keeps a small breath after phase entry before the resize
 * starts.
 *
 * Atom 2 (`flipAtom`): flip cards face-up after grow completes. The `>`
 * position lands the tween at the end of the previous one. Stagger is
 * derived to fit `flipOverlapBudget` seconds of overlap regardless of card
 * count, capped at 0.4 s so spreads with few cards don't stretch out.
 */
function composeRevealTimeline(
  context: PhaseContext,
  config: RevealPhaseConfig,
  onComplete: () => void,
): AnimationTimeline {
  const {
    cardCount,
    drawCardWidth,
    drawCardHeight,
    resultCardWidth,
    resultCardHeight,
  } = config

  const timeline = gsap.timeline({
    onComplete: () => { onComplete() },
  })

  timeline.add(() => { resetDrawsToEntryState(context, config) })

  growAtom(
    timeline,
    context,
    {
      cardCount,
      fromWidth: drawCardWidth,
      fromHeight: drawCardHeight,
      toWidth: resultCardWidth,
      toHeight: resultCardHeight,
      duration: 0.75,
      ease: 'power2.out',
    },
    '+=0.1',
  )

  const flipPerCardDuration = 1
  const flipOverlapBudget = 1.4
  const flipStagger = cardCount > 1
    ? Math.min(0.4, flipOverlapBudget / (cardCount - 1))
    : 0
  flipAtom(
    timeline,
    context,
    {
      cardCount,
      targetRotation: 180,
      duration: flipPerCardDuration,
      stagger: flipStagger,
      ease: 'power3.out',
    },
    '>',
  )

  return timeline
}

export function buildRevealPhaseRunner(config: RevealPhaseConfig): PhaseRunner {
  return {
    name: 'revealing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      return composeRevealTimeline(context, config, onComplete)
    },
  }
}
