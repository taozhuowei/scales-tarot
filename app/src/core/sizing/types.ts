/**
 * Name: core/sizing/types
 * Purpose: card sizing and spread envelope requirement types.
 * Reason: decouple sizing algebra from higher-level layout and animation code.
 */

export interface CardSize {
  width: number
  height: number
  gap: number
}

export type CardAspectRatio = number

export interface SpreadEnvelopeRequirement {
  /** Maximum horizontal slots that must fit inside the safe frame (including animation). */
  horizontalSlots: number
  /** Maximum vertical slots that must fit inside the safe frame (including animation). */
  verticalSlots: number
}
