/**
 * Tests for growAtom — verifies that the atom writes width/height tweens
 * into a real GSAP timeline that converge to the configured `to*` values.
 *
 * Uses GSAP timeline `seek()` to deterministically advance time instead of
 * wall-clock setTimeout, so CI machines don't flake on slow runs.
 */
import { describe, it, expect } from 'vitest'
import gsap from 'gsap'
import { growAtom } from '../src/animation/atoms/grow'
import type { AtomContext } from '../src/animation/atoms/types'

function makeContext(cardCount = 1): {
  cardElements: { draws: { x: number; y: number; rotation: number; scale: number; opacity: number; zIndex: number; width: number; height: number }[] }
  visible: { draws: { value: boolean[] } }
} {
  // Plain mutable objects — the atom only mutates draws[i].width/height.
  const draws = Array.from({ length: cardCount }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 0, width: 100, height: 160,
  }))
  return {
    cardElements: { draws },
    visible: { draws: { value: [] } },
  }
}

/**
 * Cast helper: the test fixture only populates the slice of PhaseContext
 * that growAtom touches (`draws`). Production AtomContext expects the
 * full PhaseContext shape — for unit tests we narrow via a typed cast so
 * we don't need to fabricate every unrelated state object.
 */
function asAtomCtx(ctx: ReturnType<typeof makeContext>): AtomContext {
  return ctx as unknown as AtomContext
}

describe('growAtom', () => {
  it('animates draws[i].width and height from fromSize to toSize', () => {
    const ctx = makeContext(1)
    const tl = gsap.timeline({ paused: true })
    growAtom(tl, asAtomCtx(ctx), {
      cardCount: 1, fromWidth: 100, fromHeight: 160,
      toWidth: 300, toHeight: 480,
      duration: 0.5, ease: 'none',
    })
    // Deterministic seek to end of timeline (no wall-clock dependency).
    tl.seek(tl.duration())
    expect(ctx.cardElements.draws[0].width).toBeCloseTo(300, 0)
    expect(ctx.cardElements.draws[0].height).toBeCloseTo(480, 0)
  })

  it('initial set primes draws to fromSize even when out-of-band value is wrong', () => {
    const ctx = makeContext(1)
    ctx.cardElements.draws[0].width = 50  // out-of-band initial
    ctx.cardElements.draws[0].height = 80
    const tl = gsap.timeline({ paused: true })
    growAtom(tl, asAtomCtx(ctx), {
      cardCount: 1, fromWidth: 100, fromHeight: 160,
      toWidth: 300, toHeight: 480,
      duration: 0.5, ease: 'none',
    })
    // Seek a sliver past 0 — the `set` runs at startAt (time 0) and the
    // tween has barely begun (linear interpolation: width ~= 100.04 at
    // t=0.0001). The point: width must NOT be 50 (out-of-band original).
    tl.seek(0.0001)
    expect(ctx.cardElements.draws[0].width).toBeGreaterThan(99)
    expect(ctx.cardElements.draws[0].width).toBeLessThan(105)
    expect(ctx.cardElements.draws[0].height).toBeGreaterThan(159)
    expect(ctx.cardElements.draws[0].height).toBeLessThan(165)
  })

  it('animates only the first cardCount draws (boundary)', () => {
    const ctx = makeContext(3)
    const tl = gsap.timeline({ paused: true })
    growAtom(tl, asAtomCtx(ctx), {
      cardCount: 2,  // only first 2 cards
      fromWidth: 100, fromHeight: 160,
      toWidth: 300, toHeight: 480,
      duration: 0.5, ease: 'none',
    })
    tl.seek(tl.duration())
    // First two animated.
    expect(ctx.cardElements.draws[0].width).toBeCloseTo(300, 0)
    expect(ctx.cardElements.draws[1].width).toBeCloseTo(300, 0)
    // Third untouched (still at original 100×160).
    expect(ctx.cardElements.draws[2].width).toBe(100)
    expect(ctx.cardElements.draws[2].height).toBe(160)
  })

  it('handles zero cardCount without throwing', () => {
    const ctx = makeContext(2)
    const tl = gsap.timeline({ paused: true })
    expect(() => {
      growAtom(tl, asAtomCtx(ctx), {
        cardCount: 0,
        fromWidth: 100, fromHeight: 160,
        toWidth: 300, toHeight: 480,
        duration: 0.5, ease: 'none',
      })
      tl.seek(tl.duration())
    }).not.toThrow()
    // No draws mutated.
    expect(ctx.cardElements.draws[0].width).toBe(100)
  })
})
