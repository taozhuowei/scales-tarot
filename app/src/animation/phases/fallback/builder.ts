/**
 * Name: animation/phases/fallback/builder
 * Purpose: builds the fallback orbital animation (PRD §7.5.2).
 * Reason: extracted into a builder so FallbackOrbits.vue stays declarative.
 *         Uses parametric trig (x = rx·cos θ, y = ry·sin θ) instead of
 *         GSAP MotionPath — the plugin is not configured in this project.
 * Data flow: caller supplies mutable planet state objects and a flush
 *           callback. Returns a cleanup function that stops the GSAP ticker
 *           listener. In reduced-motion mode planets are positioned at their
 *           initial orbit angles and no motion occurs.
 */

import gsap from 'gsap'
import { prefersReducedMotion } from '../../../core/utils/accessibility'

export interface OrbitingPlanet {
  /** Current orbit angle in radians. */
  angle: number
  /** Horizontal semi-axis of the elliptical orbit (px). */
  rx: number
  /** Vertical semi-axis of the elliptical orbit (px). */
  ry: number
  /** Angular velocity (radians per second). */
  speed: number
  /** Starting angle offset (radians). */
  phaseOffset: number
  /** Computed x offset from orbit centre (px). */
  x: number
  /** Computed y offset from orbit centre (px). */
  y: number
  /** Depth scale in [0.72, 1.28] — encodes z-depth as CSS scale. */
  depthScale: number
  /** Accumulated self-rotation angle (degrees). */
  selfRotation: number
  /** Self-rotation speed (degrees per second). */
  selfRotSpeed: number
}

/** Default planet configuration matching PRD §7.5.2 four-body layout. */
export function createDefaultPlanets(): OrbitingPlanet[] {
  return [
    // tetrahedron — innermost, fastest
    { angle: 0, rx: 80,  ry: 28, speed: 0.52, phaseOffset: 0,             x: 0, y: 0, depthScale: 1, selfRotation: 0, selfRotSpeed: 72 },
    // parallelepiped
    { angle: 0, rx: 120, ry: 42, speed: 0.38, phaseOffset: Math.PI * 0.7, x: 0, y: 0, depthScale: 1, selfRotation: 0, selfRotSpeed: 54 },
    // sphere
    { angle: 0, rx: 165, ry: 58, speed: 0.27, phaseOffset: Math.PI * 1.3, x: 0, y: 0, depthScale: 1, selfRotation: 0, selfRotSpeed: 40 },
    // octahedron — outermost, slowest
    { angle: 0, rx: 210, ry: 74, speed: 0.18, phaseOffset: Math.PI * 1.85, x: 0, y: 0, depthScale: 1, selfRotation: 0, selfRotSpeed: 63 },
  ]
}

function applyOrbitalMath(planet: OrbitingPlanet): void {
  const sinA = Math.sin(planet.angle)
  planet.x = planet.rx * Math.cos(planet.angle)
  planet.y = planet.ry * sinA
  // Map sin θ ∈ [-1, 1] → depthScale ∈ [0.72, 1.28]
  planet.depthScale = 0.72 + 0.56 * (sinA + 1) / 2
}

/**
 * Start the fallback orbital animation.
 *
 * Planets are first positioned at their initial phase offsets, then the GSAP
 * ticker drives continuous orbital motion. Returns a cleanup function that
 * should be called on component unmount.
 */
export function startFallbackAnimation(
  planets: OrbitingPlanet[],
  onUpdate: () => void,
): () => void {
  // Seed initial positions so there is no jump on first render.
  planets.forEach((p) => {
    p.angle = p.phaseOffset
    applyOrbitalMath(p)
  })
  onUpdate()

  if (prefersReducedMotion()) return () => {}

  const tickerCallback = (_time: number, deltaTime: number) => {
    // deltaTime is in ms; skip abnormally large gaps (tab was hidden).
    if (deltaTime <= 0 || deltaTime > 500) return
    const dt = deltaTime / 1000

    planets.forEach((p) => {
      p.angle += p.speed * dt
      p.selfRotation = (p.selfRotation + p.selfRotSpeed * dt) % 360
      applyOrbitalMath(p)
    })
    onUpdate()
  }

  gsap.ticker.add(tickerCallback)
  return () => gsap.ticker.remove(tickerCallback)
}
