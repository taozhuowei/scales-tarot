/**
 * Name: overlay_progress/index
 * Purpose: public API for the overlay progress system.
 * Reason: readable imports with no unrelated exports.
 */

export {
  createProgressModel,
  calculatePhaseProgress,
  type ProgressModel,
  type ProgressState,
  type PhaseProgressItem,
} from './phase_progress_model'

export {
  presentProgressHeader,
  presentFooter,
  presentPositionBadge,
  DEFAULT_OVERLAY_TEXT,
  type ProgressBarItem,
  type ProgressHeaderPresentation,
  type FooterPresentation,
  type OverlayText,
} from './phase_progress_presenter'
