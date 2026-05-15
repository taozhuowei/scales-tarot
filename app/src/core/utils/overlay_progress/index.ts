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
  // Note: `presentPositionBadge` is intentionally NOT re-exported here. It
  // is currently consumed only by tests (which import from the inner module
  // directly) and re-exporting it through the facade made knip flag it as a
  // dead export. If a runtime caller ever needs it, add the re-export back.
  DEFAULT_OVERLAY_TEXT,
  type ProgressBarItem,
  type ProgressHeaderPresentation,
  type FooterPresentation,
  type OverlayText,
} from './phase_progress_presenter'
