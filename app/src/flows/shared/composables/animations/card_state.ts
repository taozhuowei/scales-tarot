/**
 * Name: flows/shared/composables/animations/card_state
 * Purpose: shared animation state shapes for overlay animations.
 * Reason: keep animation state contracts explicit and reusable; lives in the
 *   shared animation base layer that all flows consume.
 */

export interface CardState {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number
  opacity: number
}

export interface CenterCardState {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
}

/**
 * DrawCardState — extends CenterCardState with first-class width/height
 * so the reveal phase animates DOM real size (not transform scale).
 * The size fields are written through the reconciler into a separate
 * `:style` binding, while x/y/rotation/scale go to the transform binding.
 */
export interface DrawCardState extends CenterCardState {
  width: number
  height: number
}

export interface InnerState {
  rotationY: number
}

/**
 * Animation timeline contract that phase plugins consume. Decoupled from
 * GSAP so the engine can be swapped without touching builders.
 */
export interface AnimationTimeline {
  to(target: unknown, vars: Record<string, unknown>, position?: number | string): AnimationTimeline
  fromTo(target: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>, position?: number | string): AnimationTimeline
  add(fn: () => void, position?: number | string): AnimationTimeline
  kill(): void
  clear(): void
  [key: string]: unknown
}
