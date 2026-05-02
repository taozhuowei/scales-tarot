/**
 * Module: animation/engine
 * Purpose: animation timeline contract that phase plugins consume. Decoupled
 *          from GSAP so the engine can be swapped without touching builders.
 * Reason: extracted from core/animation/types.ts during architecture cleanup.
 */

export interface AnimationTimeline {
  to(target: unknown, vars: Record<string, unknown>, position?: number | string): AnimationTimeline
  fromTo(target: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>, position?: number | string): AnimationTimeline
  add(fn: () => void, position?: number | string): AnimationTimeline
  kill(): void
  clear(): void
  [key: string]: unknown
}
