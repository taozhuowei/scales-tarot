/**
 * Name: math
 * Purpose: shared math utilities to avoid duplicate definitions.
 * Reason: clamp() was independently defined in 3+ modules before centralization.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
