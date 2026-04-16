/**
 * Name: overlay_layout/index
 * Purpose: public API barrel for the overlay layout system.
 * Reason: consumers should import from one folder instead of scattered files.
 */

export type {
  OverlaySafeFrame,
} from './overlay_safe_frame'

export {
  resolveOverlaySafeFrame,
} from './overlay_safe_frame'

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
  CutLayoutResult,
  RevealMotionPlan,
} from './scene_layout'
export type { OverlayViewportMetrics } from '../overlay_viewport'

export {
  resolveSceneLayout,
  resolveCutLayout,
  resolveRevealMotion,
  getFocusScale,
  getBadgeOverflowPx,
} from './scene_layout'
export { resolveOverlayViewport } from '../overlay_viewport'

export type {
  CardSizeInput,
} from './card_size_solver'

export {
  resolveCardSize,
  DEFAULT_ENVELOPE_GAP,
} from './card_size_solver'

export type {
  SpreadSolverInput,
} from './spread_solver'

export {
  resolveSpreadLayout,
} from './spread_solver'

export {
  BUILT_IN_SPREADS,
  getSpreadSpec,
  registerSpread,
  getSpreadCardCount,
  getSpreadSlots,
} from './spread_registry'
