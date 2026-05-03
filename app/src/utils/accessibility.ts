/**
 * Shared accessibility utilities.
 */

export function prefersReducedMotion(): boolean {
  // #ifdef H5
  /* eslint-disable no-restricted-globals -- reason: H5-only DOM API (window.matchMedia) */
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  /* eslint-enable no-restricted-globals */
  // #endif
  return false
}

