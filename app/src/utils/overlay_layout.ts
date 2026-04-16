/**
 * Name: overlay_layout (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered layout system.
 */

export { resolveOverlayViewport } from './overlay_layout/index'
export {
  resolveSceneLayout,
  resolveMotionMetrics,
  resolveOverlaySafeFrame,
  resolveCutLayout,
  resolveRevealMotion,
  getFocusScale,
  getBadgeOverflowPx,
  resolveSceneLayout as resolveOverlaySceneLayout,
} from './overlay_layout/index'
export type {
  SceneLayoutResult as OverlaySceneLayout,
  SceneLayoutResult as SceneLayout,
  SceneLayoutResult,
  OverlaySafeFrame,
  OverlayViewportMetrics,
  SpreadLayoutResult,
  SpreadCardLayout,
  CardEnvelope as CardSizeResult,
} from './overlay_layout/index'
