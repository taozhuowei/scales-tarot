/**
 * Name: composables/flows/divination/phases/draw
 * Purpose: PhaseRunner wrapper for the draw phase — a thin dispatcher
 *          that picks the reduced-motion vs full animated timeline.
 * Reason: timeline construction lives in ./draw_timeline so this file
 *          stays a small, stable PhaseRunner adapter (consumed by
 *          pipeline_builder).
 */

import type { AnimationTimeline } from '../../../shared/animations/card_state'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../shared/animations/contracts'
import { prefersReducedMotion } from '../../../../core/utils/accessibility'
import {
  buildReducedMotionDrawTimeline,
  buildAnimatedDrawTimeline,
} from './draw_timeline'
import type { DrawPhaseConfig } from './draw_timeline'

export type { DrawPhaseConfig }

export function buildDrawPhaseRunner(config: DrawPhaseConfig): PhaseRunner {
  return {
    name: 'drawing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      return prefersReducedMotion()
        ? buildReducedMotionDrawTimeline(context, config, onComplete)
        : buildAnimatedDrawTimeline(context, config, onComplete)
    },
  }
}
