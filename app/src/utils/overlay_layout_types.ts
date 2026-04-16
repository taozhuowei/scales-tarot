/**
 * Name: overlay_layout_types (compatibility shim)
 * Purpose: backward-compatible type re-exports for the foldered layout system.
 */

export type { SpreadId as SpreadKind, SpreadScene } from './overlay_layout/spread_spec'
export type { SpreadCardLayout, SpreadLayoutResult } from './overlay_layout/spread_spec'
export type { SpreadSolverInput } from './overlay_layout/spread_solver'

export interface SpreadLayoutInput {
  spreadKind: string
  scene: import('./overlay_layout/spread_spec').SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  cardAspectRatio: number
  headerHeight?: number
}
