/**
 * Name: overlay_animation/types
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

export type OverlayPhase = 'shuffling' | 'cutting' | 'drawing' | 'revealing'
