/**
 * Name: timeline_orchestrator
 * Purpose: orchestrate GSAP timelines for overlay animations.
 * Reason: centralize timeline management while delegating phase-specific animations to dedicated modules.
 * Data flow: animation configurations flow in; timeline controls flow out.
 */

import gsap from 'gsap'
import type { OverlayPhase } from './types'

export interface TimelineOrchestrator {
  readonly timeline: gsap.core.Timeline
  readonly isPaused: boolean
  readonly playbackRate: number
  play(): void
  pause(): void
  resume(): void
  setPlaybackRate(rate: number): void
  stepForward(): void
  stepBackward(): void
  seek(position: number | string): void
  clear(): void
  kill(): void
  add(child: gsap.core.Timeline, position?: number | string): gsap.core.Timeline
}

export function createTimelineOrchestrator(
  paused: boolean = false,
): TimelineOrchestrator {
  const masterTimeline = gsap.timeline({ paused })
  let currentPlaybackRate = 1
  let isPaused = paused

  return {
    get timeline() {
      return masterTimeline
    },
    get isPaused() {
      return isPaused
    },
    get playbackRate() {
      return currentPlaybackRate
    },
    play() {
      masterTimeline.play()
      isPaused = false
    },
    pause() {
      masterTimeline.pause()
      isPaused = true
    },
    resume() {
      masterTimeline.resume()
      isPaused = false
    },
    setPlaybackRate(rate: number) {
      currentPlaybackRate = rate
      masterTimeline.timeScale(rate)
    },
    stepForward() {
      const currentTime = masterTimeline.time()
      masterTimeline.time(currentTime + 1 / 60)
    },
    stepBackward() {
      const currentTime = masterTimeline.time()
      masterTimeline.time(Math.max(0, currentTime - 1 / 60))
    },
    seek(position: number | string) {
      masterTimeline.seek(position)
    },
    clear() {
      masterTimeline.clear()
      masterTimeline.time(0)
    },
    kill() {
      masterTimeline.kill()
    },
    add(child: gsap.core.Timeline, position?: number | string) {
      return masterTimeline.add(child, position)
    },
  }
}

export interface PhaseTransitionHandlers {
  onPhaseChange: (phase: OverlayPhase) => void
  onComplete: () => void
}

/**
 * Kill all tweens for the given targets.
 */
export function killAnimationTargets(targets: unknown[]): void {
  gsap.killTweensOf(targets)
}
