/**
 * Name: core/animation/animation_engine
 * Purpose: thin GSAP wrapper providing the AnimationEngine interface.
 * Reason: isolate GSAP imports to a single file so the rest of core stays vendor-agnostic.
 */

import gsap from 'gsap'
import type { AnimationEngine, AnimationTimeline, TweenConfig } from './types'

class GsapTimelineAdapter implements AnimationTimeline {
  private timeline: gsap.core.Timeline

  constructor(timeline: gsap.core.Timeline) {
    this.timeline = timeline
  }

  to(target: unknown, vars: Record<string, unknown>, position?: number | string): AnimationTimeline {
    this.timeline.to(target as gsap.TweenTarget, vars as gsap.TweenVars, position)
    return this
  }

  fromTo(target: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>, position?: number | string): AnimationTimeline {
    this.timeline.fromTo(target as gsap.TweenTarget, fromVars as gsap.TweenVars, toVars as gsap.TweenVars, position)
    return this
  }

  add(fn: () => void, position?: number | string): AnimationTimeline {
    this.timeline.add(fn, position)
    return this
  }

  kill(): void {
    this.timeline.kill()
  }

  clear(): void {
    this.timeline.clear()
    this.timeline.time(0)
  }
}

export function createEngine(): AnimationEngine {
  return {
    createTimeline(config) {
      const tl = gsap.timeline(config)
      return new GsapTimelineAdapter(tl)
    },
    tweenTo(target, vars, config) {
      const tween = gsap.to(target as gsap.TweenTarget, {
        ...vars,
        duration: config?.duration ?? 0.5,
        ease: config?.ease,
        delay: config?.delay,
        stagger: config?.stagger,
        overwrite: config?.overwrite,
        onUpdate: config?.onUpdate,
        onComplete: config?.onComplete,
      })
      return { kill: () => tween.kill() }
    },
    killTweensOf(targets) {
      gsap.killTweensOf(targets as gsap.TweenTarget[])
    },
  }
}
