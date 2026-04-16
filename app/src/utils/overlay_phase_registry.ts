/**
 * Name: overlay_phase_registry (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered phase registry.
 * Reason: existing imports continue to work while the new structure is adopted.
 */

export {
  PHASE_STEPS,
  getPhaseSteps,
  getPhaseIndex,
  getPhaseStep,
  isValidPhase,
  getNextPhase,
  type OverlayPhase,
  type PhaseStep,
} from './overlay_animation/phase_registry'
