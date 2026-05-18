/**
 * Tests for flipAtom — verifies that the atom writes rotationY tweens into
 * a real GSAP timeline and that staggers introduce per-card delay.
 *
 * Uses GSAP timeline `seek()` for deterministic time-advancement instead of
 * wall-clock setTimeout, so CI machines don't flake on slow runs.
 */
import { describe, it, expect } from 'vitest'
import gsap from 'gsap'
import { flipAtom } from '../src/flows/shared/composables/animations/flip'
import type { AtomContext } from '../src/flows/shared/composables/animations/contracts'

function makeContext(cardCount = 1): {
  cardElements: { inners: { rotationY: number }[] }
  visible: Record<string, never>
} {
  const inners = Array.from({ length: cardCount }, () => ({ rotationY: 0 }))
  return {
    cardElements: { inners },
    visible: {},
  }
}

/**
 * Cast helper: the test fixture only populates `inners` — the slice of
 * PhaseContext that flipAtom reads. Narrow the production AtomContext
 * type via an explicit cast so we don't need to stub every unrelated
 * state field.
 */
function asAtomCtx(ctx: ReturnType<typeof makeContext>): AtomContext {
  return ctx as unknown as AtomContext
}

describe('flipAtom', () => {
  it('animates inners[i].rotationY to targetRotation', () => {
    const ctx = makeContext(1)
    const tl = gsap.timeline({ paused: true })
    flipAtom(tl, asAtomCtx(ctx), {
      cardCount: 1, targetRotation: 180,
      duration: 0.4, stagger: 0,
    })
    tl.seek(tl.duration())
    expect(ctx.cardElements.inners[0].rotationY).toBeCloseTo(180, 0)
  })

  it('staggers across multiple cards (mid-timeline ordering)', () => {
    const ctx = makeContext(3)
    const tl = gsap.timeline({ paused: true })
    flipAtom(tl, asAtomCtx(ctx), {
      cardCount: 3, targetRotation: 180,
      duration: 0.4, stagger: 0.2,
    })
    // Seek to t = 0.1s — card 0 has been animating for 0.1s (25% of its
    // 0.4s duration), card 1 starts at t=0.2s (so still at 0), card 2 at
    // t=0.4s. Verify ordering: r0 > r1 = r2 = 0.
    tl.seek(0.1)
    const r0 = ctx.cardElements.inners[0].rotationY
    const r1 = ctx.cardElements.inners[1].rotationY
    const r2 = ctx.cardElements.inners[2].rotationY
    expect(r0).toBeGreaterThan(0)
    expect(r1).toBeCloseTo(0, 1)  // card 1 hasn't started yet
    expect(r2).toBeCloseTo(0, 1)  // card 2 hasn't started yet
  })

  it('handles zero cardCount without throwing', () => {
    const ctx = makeContext(2)
    const tl = gsap.timeline({ paused: true })
    expect(() => {
      flipAtom(tl, asAtomCtx(ctx), {
        cardCount: 0, targetRotation: 180,
        duration: 0.4, stagger: 0,
      })
      tl.seek(tl.duration())
    }).not.toThrow()
    expect(ctx.cardElements.inners[0].rotationY).toBe(0)
  })

  it('supports reverse flip via custom targetRotation (180 → 0 path)', () => {
    const ctx = makeContext(1)
    ctx.cardElements.inners[0].rotationY = 180  // already flipped
    const tl = gsap.timeline({ paused: true })
    flipAtom(tl, asAtomCtx(ctx), {
      cardCount: 1, targetRotation: 0,
      duration: 0.4, stagger: 0,
    })
    tl.seek(tl.duration())
    expect(ctx.cardElements.inners[0].rotationY).toBeCloseTo(0, 0)
  })
})
