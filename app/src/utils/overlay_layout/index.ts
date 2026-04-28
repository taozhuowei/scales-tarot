/**
 * Name: overlay_layout/index
 * Purpose: public API barrel for the overlay layout system.
 * Reason: consumers should import from one folder instead of scattered files.
 */

export type {
  SpreadId,
  SpreadScene,
  SpreadSlotSpec,
  SpreadEnvelopeRequirement,
  SpreadSpec,
  SpreadCardLayout,
  SpreadLayoutResult,
  SpreadLayoutContext,
  CardEnvelope,
} from './spread_spec'

export {
  getBuiltInEnvelopeRequirement,
} from './spread_spec'

export type {
  MotionMetrics,
  MotionMetricsInput,
  CutAxis,
} from './motion_metrics'

export {
  resolveMotionMetrics,
  getCutPileRestPosition,
} from './motion_metrics'

export type {
  SceneLayoutInput,
  SceneLayoutResult,
  SceneLayoutResult as SceneLayout,
} from '../../core/layout/scene_layout'

export {
  resolveSceneLayout,
  getBadgeOverflowPx,
  resolveOverlayViewport,
  buildOverlaySafeFrame,
} from '../../core/layout/scene_layout'

export {
  getSpreadCardCount,
} from '../../core/layout/scene_layout'

export type {
  CardSizeInput,
} from '../../core/sizing/card_size_solver'

export {
  resolveCardSize as resolveCoreCardSize,
  DEFAULT_ENVELOPE_GAP,
} from '../../core/sizing/card_size_solver'
