/**
 * Browser-side secure random helpers.
 *
 * Why a dedicated module:
 *   The repository's quality scanner forbids the global insecure RNG
 *   outside tests (see scripts/quality_scan.js, scanMathRandom). The
 *   remaining frontend randomness is purely cosmetic — a few degrees of
 *   pre-flip rotation jitter on draw cards — but the rule applies
 *   blanket-style. Wrapping `crypto.getRandomValues` here keeps business
 *   code clean and the scanner happy without paying meaningful runtime
 *   cost.
 *
 * Platform support:
 *   `crypto.getRandomValues` is available in all H5 browsers we ship to
 *   and in WeChat Mini Program runtimes ≥ 2.18. The thin polyfill below
 *   gracefully degrades for ancient runtimes by reading from
 *   `Date.now()` — we accept lower entropy because the only consumer is
 *   visual jitter; nothing about fairness or security depends on it.
 */

interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(arr: T): T
}

function getCrypto(): CryptoLike | null {
  const g = globalThis as { crypto?: CryptoLike }
  return g.crypto && typeof g.crypto.getRandomValues === 'function' ? g.crypto : null
}

// Monotonic counter that breaks same-tick collisions in the fallback path.
// Without it, multiple calls inside one millisecond all return the same
// `Date.now() % 1e6 / 1e6` value, which would make every draw card share
// the same jitter angle when the loop runs synchronously. Multiplying by
// Knuth's 32-bit hash constant (2654435761) and masking back to 32 bits
// produces a cheap, well-distributed scramble for the visual-jitter use
// case — nothing here protects fairness or security.
let _fallbackCounter = 0
function fallbackRandomFloat(): number {
  _fallbackCounter = (_fallbackCounter + 1) >>> 0
  const seed = ((Date.now() & 0xff_ff_ff_ff) + _fallbackCounter) >>> 0
  return ((seed * 2654435761) >>> 0) / 0x1_0000_0000
}

/** Uniform float in [0, 1). Source-agnostic, see file header. */
export function randomFloat(): number {
  const c = getCrypto()
  if (c) {
    const arr = new Uint32Array(1)
    c.getRandomValues(arr)
    return arr[0] / 0x1_0000_0000
  }
  return fallbackRandomFloat()
}

/** Uniform float in [min, max). */
export function randomInRange(min: number, max: number): number {
  return min + randomFloat() * (max - min)
}
