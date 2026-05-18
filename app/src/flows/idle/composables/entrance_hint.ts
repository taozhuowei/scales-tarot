/**
 * Name: flows/idle/composables/entrance_hint
 * Purpose: the idle touch-hint fade — runs once per idle entrance so it
 *          doesn't compete with the title GSAP entrance. Honors
 *          reduced-motion.
 * Reason: split out of use_play_deck_animation — a single-responsibility
 *          idle entrance affordance. Body byte-identical to the original.
 * Data flow: tweens the passed hintState.opacity and mirrors it into the
 *          hintOpacity ref on each frame.
 */

import { gsap } from 'gsap'
import type { Ref } from 'vue'
import { prefersReducedMotion } from '../../../core/utils/accessibility'

/**
 * Touch-hint fade — runs once per idle entrance so it doesn't compete
 * with the title GSAP entrance. Honors reduced-motion.
 */
export function runEntranceHint(hintOpacity: Ref<number>, hintState: { opacity: number }): void {
  hintState.opacity = 0
  if (prefersReducedMotion()) {
    hintOpacity.value = 0.6
    return
  }
  gsap.to(hintState, {
    opacity: 0.6,
    duration: 0.8,
    delay: 0.6,
    onUpdate: () => { hintOpacity.value = hintState.opacity },
  })
}
