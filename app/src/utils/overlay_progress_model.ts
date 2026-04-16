/**
 * Name: overlay_progress_model (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered progress model.
 */

export {
  createProgressModel,
  calculatePhaseProgress,
  type ProgressModel,
  type ProgressState,
  type PhaseProgressItem,
} from './overlay_progress/phase_progress_model'
