/**
 * Name: animation/types
 * Purpose: shared animation state types for overlay animations.
 * Reason: keep animation state contracts explicit and reusable.
 */

export interface CardState {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number
  opacity: number
}

export interface CenterCardState {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
}

/**
 * DrawCardState — extends CenterCardState with first-class width/height
 * so the reveal phase animates DOM real size (not transform scale).
 * The size fields are written through the reconciler into a separate
 * `:style` binding, while x/y/rotation/scale go to the transform binding.
 */
export interface DrawCardState extends CenterCardState {
  width: number
  height: number
}

export interface InnerState {
  rotationY: number
}

export interface BackgroundState {
  opacity: number
}

export interface StageState {
  y: number
}

export interface HeaderState {
  y: number
  opacity: number
}

export interface FooterState {
  y: number
  opacity: number
}

export interface DeckContainerState {
  x: number
}
