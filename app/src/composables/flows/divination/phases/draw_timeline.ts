/**
 * Name: composables/flows/divination/phases/draw_timeline
 * Purpose: GSAP timeline construction for the draw phase — timing
 *          derivation, the reduced-motion snap path, and the full
 *          animated path (stage lift → deck exit → per-card deal →
 *          align → reveal hand-off).
 * Reason: split out of builder.ts so the PhaseRunner wrapper stays a
 *          thin dispatcher and each builder fn stays under the size cap.
 *          Bodies are verbatim from the previous single-file inline
 *          implementation — behaviour identical.
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs.
import gsap from 'gsap'
import type { AnimationTimeline } from '../../../shared/animations/card_state'
import type { PhaseContext } from '../../../shared/animations/contracts'
import { randomInRange } from '../../../../core/utils/secure_random'

/**
 * Cosmetic jitter (a few degrees of pre-flip rotation per card). Routed
 * through `secure_random` so the repo-wide rule against the global
 * insecure RNG holds; randomness quality does not affect correctness here.
 */
function jitterDeg(min: number, max: number): number {
  return randomInRange(min, max)
}

export interface DrawPhaseConfig {
  cardCount: number
  /** Draw-stage card width. Used to set draws[i].width on entry so the
   *  DOM real size equals the solver-computed size before any tween runs. */
  cardWidth: number
  cardHeight: number
  stageHeight: number
  liftY: number
  targetX: number[]
  targetY: number[]
  autoRevealDelayMs: number
  /** Called when the last card finishes settling at its final position. */
  onCardsLanded?: () => void
}

interface DrawTimings {
  drawStartTime: number
  pullDuration: number
  fallDuration: number
  reboundDuration: number
  settleDuration: number
  stageFollowStart: number
  deckExitStart: number
  perCardDelay: number
  lastCardLandingTime: number
  alignTime: number
  revealingStart: number
  finishTime: number
  preRotations: number[]
}

/**
 * Derive every time offset + the per-card jitter for the animated draw
 * path. Extracted verbatim from the previous inline block (called once
 * per run, so the random preRotations are still drawn exactly once).
 */
function computeDrawTimings(config: DrawPhaseConfig): DrawTimings {
  const { cardCount, autoRevealDelayMs } = config

  const drawStartTime = 0.88
  const pullDuration = 0.18
  const fallDuration = 0.78
  const reboundDuration = 0.34
  const settleDuration = 0.82
  const stageFollowStart = drawStartTime + pullDuration - 0.02
  const deckExitStart = stageFollowStart + 0.06

  const dealOverlapBudget = 1.6
  const perCardDelay = cardCount > 1
    ? Math.min(0.34, dealOverlapBudget / (cardCount - 1))
    : 0

  const lastCardLandingTime = drawStartTime
    + (cardCount - 1) * perCardDelay
    + pullDuration
    + fallDuration
    + reboundDuration
    + settleDuration

  const alignTime = lastCardLandingTime + 0.28

  // Flip is now owned by the reveal phase (see animation/atoms/flip).
  // Per requirement N2: the historical 1.0s "breath" between alignment
  // and the reveal hand-off was dead weight on top of the alignment
  // tween + per-card settle, so it has been removed. `revealDelay`
  // (driven by AUTO_REVEAL_DELAY_MS) is also 0 by default — kept as a
  // dial for future tuning without touching this builder.
  const revealDelay = autoRevealDelayMs / 1000
  const revealingStart = alignTime + revealDelay
  const finishTime = revealingStart + 0.3

  const preRotations = Array.from({ length: cardCount }, () => jitterDeg(-7.5, 7.5))

  return {
    drawStartTime,
    pullDuration,
    fallDuration,
    reboundDuration,
    settleDuration,
    stageFollowStart,
    deckExitStart,
    perCardDelay,
    lastCardLandingTime,
    alignTime,
    revealingStart,
    finishTime,
    preRotations,
  }
}

interface CardDealDeps {
  draws: PhaseContext['cardElements']['draws']
  drawsVisible: PhaseContext['visible']['draws']
  cardWidth: number
  cardHeight: number
  stageHeight: number
  targetX: number[]
  targetY: number[]
  preRotations: number[]
  drawStartTime: number
  perCardDelay: number
  pullDuration: number
  fallDuration: number
  reboundDuration: number
  settleDuration: number
}

/**
 * Append one card's deal sequence (entry snap → pull → fall → rebound →
 * settle) to the timeline. Verbatim from the previous inline loop body;
 * the `'>'` positions stay sequence-correct because the calls run in the
 * same order against the same timeline.
 */
function appendCardDealTween(timeline: AnimationTimeline, i: number, d: CardDealDeps): void {
  const cardTime = d.drawStartTime + i * d.perCardDelay

  timeline.add(() => {
    Object.assign(d.draws[i], {
      x: 0,
      y: i === 0 ? 0 : -d.stageHeight,
      rotation: 0,
      scale: 0.98,
      opacity: 1,
      zIndex: 20 - i,
      width: d.cardWidth,
      height: d.cardHeight,
    })
    const visible = [...d.drawsVisible.value]
    visible[i] = true
    d.drawsVisible.value = visible
  }, cardTime)

  timeline.to(d.draws[i], {
    x: d.targetX[i] * 0.08,
    y: -d.cardHeight * 0.18,
    rotation: d.preRotations[i],
    scale: 1.03,
    duration: d.pullDuration,
    ease: 'power2.out',
  }, '>')

  timeline.to(d.draws[i], {
    x: d.targetX[i],
    y: d.targetY[i] + d.cardHeight * 0.86,
    duration: d.fallDuration,
    ease: 'power2.in',
  }, '>')

  timeline.to(d.draws[i], {
    y: d.targetY[i] + d.cardHeight * 0.18,
    rotation: d.preRotations[i] * 0.3,
    scale: 0.98,
    duration: d.reboundDuration,
    ease: 'power2.out',
  }, '>')

  timeline.to(d.draws[i], {
    y: d.targetY[i],
    rotation: 0,
    scale: 1,
    duration: d.settleDuration,
    ease: 'power3.out',
  }, '>')
}

/**
 * Reduced-motion draw path: snap straight to the landed layout, no
 * tweens. Body verbatim from the previous inline branch.
 */
export function buildReducedMotionDrawTimeline(
  context: PhaseContext,
  config: DrawPhaseConfig,
  onComplete: () => void,
): AnimationTimeline {
  const { initials, draws, stage, deckCtn } = context.cardElements
  const { draws: drawsVisible } = context.visible
  const { cardCount, cardWidth, cardHeight, liftY, targetX, targetY, onCardsLanded } = config

  const timeline = gsap.timeline()
  timeline.add(() => {
    stage.y = -liftY
    Object.assign(deckCtn, { x: 0 })
    initials.forEach((state, index) => {
      Object.assign(state, { opacity: 0, y: -cardHeight * 1.12 - index * 1.6, scale: 0.74 })
    })
    const visible = [...drawsVisible.value]
    for (let i = 0; i < cardCount; i++) {
      Object.assign(draws[i], {
        x: targetX[i],
        y: targetY[i],
        rotation: 0,
        scale: 1,
        opacity: 1,
        zIndex: 20 - i,
        width: cardWidth,
        height: cardHeight,
      })
      // Cards land face-DOWN. The reveal phase owns the flip animation
      // (see animation/atoms/flip + phases/reveal/builder). Per the
      // design rule cards must be enlarged before flipping, so the flip
      // can no longer happen here.
      visible[i] = true
    }
    drawsVisible.value = visible
    if (onCardsLanded) onCardsLanded()
  }, 0)
  timeline.add(() => {
    context.onPhaseChange('revealing')
  }, 0.1)
  timeline.add(() => {
    onComplete()
  }, 0.1)
  return timeline
}

/**
 * Full animated draw path: stage lift, deck exit, per-card deal, align,
 * hand off to reveal. Body verbatim from the previous inline branch;
 * timings via computeDrawTimings, per-card tween via appendCardDealTween.
 */
export function buildAnimatedDrawTimeline(
  context: PhaseContext,
  config: DrawPhaseConfig,
  onComplete: () => void,
): AnimationTimeline {
  const { initials, draws, stage } = context.cardElements
  const { draws: drawsVisible } = context.visible
  const { cardCount, cardWidth, cardHeight, stageHeight, liftY, targetX, targetY, onCardsLanded } = config

  const timings = computeDrawTimings(config)
  const {
    deckExitStart,
    lastCardLandingTime,
    alignTime,
    revealingStart,
    finishTime,
  } = timings

  const timeline = gsap.timeline()

  // Stage lift
  timeline
    .to(stage, {
      y: -liftY * 0.84,
      duration: 0.92,
      ease: 'power2.inOut',
    }, timings.stageFollowStart)
    .to(stage, {
      y: -liftY,
      duration: 0.58,
      ease: 'power3.out',
    }, '>')

  // Deck exit
  timeline.to(initials, {
    opacity: 0,
    y: (index: number) => -cardHeight * 1.12 - index * 1.6,
    scale: 0.74,
    rotation: (index: number) => (index - 5.5) * 0.7,
    duration: 1.08,
    stagger: 0.018,
    ease: 'power2.in',
  }, deckExitStart)

  // Per-card deal animations
  const dealDeps: CardDealDeps = {
    draws,
    drawsVisible,
    cardWidth,
    cardHeight,
    stageHeight,
    targetX,
    targetY,
    preRotations: timings.preRotations,
    drawStartTime: timings.drawStartTime,
    perCardDelay: timings.perCardDelay,
    pullDuration: timings.pullDuration,
    fallDuration: timings.fallDuration,
    reboundDuration: timings.reboundDuration,
    settleDuration: timings.settleDuration,
  }
  for (let i = 0; i < cardCount; i++) {
    appendCardDealTween(timeline, i, dealDeps)
  }

  // Notify when last card settles — drives cardsFocused / cardsDocked state
  if (onCardsLanded) {
    timeline.add(() => { onCardsLanded() }, lastCardLandingTime)
  }

  // Alignment
  timeline.to(draws, {
    x: (index: number) => targetX[index],
    y: (index: number) => targetY[index],
    rotation: 0,
    duration: 0.8,
    ease: 'power3.inOut',
  }, alignTime + 0.1)

  // Flip animation lives in the reveal phase now. See
  // ./reveal.ts for the grow + flip composition.

  // Phase change
  timeline.add(() => {
    context.onPhaseChange('revealing')
  }, revealingStart)

  // Complete
  timeline.add(() => {
    onComplete()
  }, finishTime)

  return timeline
}
