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

// #ifdef H5
/* eslint-disable no-restricted-globals -- reason: H5-only DOM API (document.querySelector) */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => el.offsetParent !== null)
}

export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
/* eslint-enable no-restricted-globals */
// #endif
