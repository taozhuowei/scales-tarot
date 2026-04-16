/**
 * Name: overlay_progress_presenter (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered progress presenter.
 */

export {
  presentProgressHeader,
  presentFooter,
  presentPositionBadge,
  DEFAULT_OVERLAY_TEXT,
  type ProgressBarItem,
  type ProgressHeaderPresentation,
  type FooterPresentation,
  type OverlayText,
} from './overlay_progress/phase_progress_presenter'
