/**
 * Name: overlay_timeline (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered timeline orchestrator.
 */

export {
  createTimelineOrchestrator,
  killAnimationTargets,
  type TimelineOrchestrator,
} from './overlay_animation/timeline_orchestrator'
