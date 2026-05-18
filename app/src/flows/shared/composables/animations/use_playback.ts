/**
 * Name: flows/shared/composables/animations/use_playback
 * Purpose: GSAP timeline playback controls — pause/resume/seek/step/rate.
 * Reason: extracted from use_animation_controller to isolate playback concerns.
 * Data flow: self-contained; creates TimelineOrchestrator internally.
 */

import { ref } from 'vue'
import { createTimelineOrchestrator } from '../../../../core/gsap/timeline'
import type { TimelineOrchestrator } from '../../../../core/gsap/timeline'

export function usePlayback() {
  const isPaused = ref(false)
  const playbackRate = ref(1)
  const orchestrator: TimelineOrchestrator = createTimelineOrchestrator(false)

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    orchestrator.setPlaybackRate(rate)
  }
  function pauseAnimations() { isPaused.value = true; orchestrator.pause() }
  function resumeAnimations() { isPaused.value = false; orchestrator.resume() }
  function stepForward() { orchestrator.stepForward() }
  function stepBackward() { orchestrator.stepBackward() }
  function seek(position: number | string) { orchestrator.seek(position) }

  return {
    isPaused, playbackRate, orchestrator,
    setPlaybackRate, pauseAnimations, resumeAnimations,
    stepForward, stepBackward, seek,
    clearTimeline: () => orchestrator.clear(),
    killTimeline: () => orchestrator.kill(),
  }
}
