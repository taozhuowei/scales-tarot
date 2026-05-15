/**
 * Coverage for the browser-side secure_random fallback path.
 *
 * The crypto-backed path is platform-provided and uninteresting to test;
 * what we care about is the degraded path that fires when
 * `globalThis.crypto.getRandomValues` is absent (ancient WeChat Mini
 * Program runtimes, very old WebViews, hostile sandboxes). That path is
 * the one most likely to surprise — particularly because earlier versions
 * derived the value from `Date.now() % 1_000_000`, which collides with
 * itself for every call inside the same millisecond.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('secure_random fallback (no globalThis.crypto)', () => {
  let originalCrypto: PropertyDescriptor | undefined

  beforeEach(() => {
    // Capture and remove `crypto` so getCrypto() returns null on every call.
    // We restore it in afterEach so other suites stay unaffected.
    originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto)
    else delete (globalThis as { crypto?: unknown }).crypto
  })

  it('produces values inside [0, 1)', async () => {
    const { randomFloat } = await import('../src/utils/secure_random')
    for (let i = 0; i < 100; i++) {
      const v = randomFloat()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('does not collide on rapid same-tick calls', async () => {
    // The original fallback (`Date.now() % 1e6 / 1e6`) returns identical
    // values when called 32 times back-to-back inside one millisecond.
    // The current implementation breaks the tie via a monotonic counter
    // mixed through Knuth's hash constant; the regression test asserts
    // we get at least 30 distinct values out of 32 quick calls.
    const { randomFloat } = await import('../src/utils/secure_random')
    const samples = new Set<number>()
    for (let i = 0; i < 32; i++) samples.add(randomFloat())
    expect(samples.size).toBeGreaterThanOrEqual(30)
  })

  it('randomInRange respects bounds', async () => {
    const { randomInRange } = await import('../src/utils/secure_random')
    for (let i = 0; i < 100; i++) {
      const v = randomInRange(-5, 5)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(5)
    }
  })
})

describe('secure_random crypto path', () => {
  it('produces values inside [0, 1) when crypto.getRandomValues is present', async () => {
    // Default vitest env (node) provides Web Crypto. If the test runner
    // ever swaps to an env that doesn't, the assertion will surface it
    // explicitly rather than silently routing through the fallback.
    const c = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto
    expect(typeof c?.getRandomValues).toBe('function')

    const { randomFloat } = await import('../src/utils/secure_random')
    for (let i = 0; i < 100; i++) {
      const v = randomFloat()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
