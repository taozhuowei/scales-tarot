/**
 * Name: core/gsap/tween
 * Purpose: GSAP tween-level helper — kill all tweens for the given targets.
 * Reason: single wrapper around gsap.killTweensOf so callers never import gsap.
 * Data flow: target list in; tweens on them are cancelled.
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'

/**
 * Kill all tweens for the given targets.
 */
export function killAnimationTargets(targets: unknown[]): void {
  gsap.killTweensOf(targets)
}
