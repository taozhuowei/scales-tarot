<template>
  <!--
    FallbackOrbits — phase-3 implementation (docs/prd/animation.md（动画分帧）).
    Central glowing star + four 3D geometric planets (tetrahedron,
    parallelepiped, sphere, octahedron) orbiting on elliptical paths.
    Motion is driven by a GSAP ticker via startFallbackAnimation(); CSS
    3D transforms convey the z-depth effect without GSAP MotionPath.
  -->
  <view class="fallback-orbits" role="img" aria-label="兜底动画">
    <view class="orbits-scene">
      <!-- Elliptical orbit track lines -->
      <view
        v-for="(planet, i) in planets"
        :key="'orbit-' + i"
        class="orbit-path"
        :style="orbitPathStyle(planet)"
      />

      <!-- Central star (renders above orbit lines, below planets at depth) -->
      <view class="central-star" />

      <!-- Orbiting planets — rendered in depthScale order so closer planets
           visually overlap farther ones.  z-index is set per planet style. -->
      <view
        v-for="(planet, i) in planets"
        :key="'planet-' + i"
        :class="['planet', `planet--${PLANET_TYPES[i]}`]"
        :style="planetStyle(planet)"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: FallbackOrbits (stage content)
 * Purpose: stage-content for the fallback view; renders the looping 3D-orbit
 *          animation (docs/prd/animation.md（动画分帧）).
 * Reason: encapsulating the orbit rig inside a dedicated stage-content
 *         component keeps FallbackView declarative. The component owns no
 *         business state — pure motion.
 * Data flow: stateless; startFallbackAnimation drives planet state via a
 *           GSAP ticker, onUpdate flushes reactive refs.
 */
import { onMounted, onUnmounted, reactive } from 'vue'
import {
  createDefaultPlanets,
  startFallbackAnimation,
  type OrbitingPlanet,
} from '../composables/flows/fallback/orbits'

const PLANET_TYPES = ['tetrahedron', 'parallelepiped', 'sphere', 'octahedron'] as const

/**
 * `planets` is a Vue reactive array — GSAP's ticker mutates planet.x /
 * .y / .depthScale / .selfRotation in place, and Vue's set-trap on the
 * reactive proxy auto-invalidates the template that reads these. No
 * manual flush counter / `void tick.value` subscription needed: reads
 * inside orbitPathStyle / planetStyle are tracked the standard Vue way.
 */
const planets = reactive(createDefaultPlanets())
let stopAnimation: (() => void) | null = null

function orbitPathStyle(planet: OrbitingPlanet) {
  return {
    width: `${planet.rx * 2}px`,
    height: `${planet.ry * 2}px`,
    marginLeft: `${-planet.rx}px`,
    marginTop: `${-planet.ry}px`,
  }
}

function planetStyle(planet: OrbitingPlanet) {
  const zIndex = Math.round(planet.depthScale * 10)
  return {
    transform: `translate(${planet.x}px, ${planet.y}px) scale(${planet.depthScale}) rotate(${planet.selfRotation}deg)`,
    zIndex,
    opacity: String(0.65 + 0.35 * (planet.depthScale - 0.72) / 0.56),
  }
}

onMounted(() => {
  // The builder's onUpdate hook is now a no-op — Vue reactivity replaces it.
  // Kept as a parameter so the builder's signature stays compatible with
  // any future caller that wants explicit batching control.
  stopAnimation = startFallbackAnimation(planets, () => {})
})

onUnmounted(() => {
  stopAnimation?.()
  stopAnimation = null
})
</script>

<style scoped>
.fallback-orbits {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.orbits-scene {
  position: relative;
  width: 480px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Orbit track lines ──────────────────────────────────────────────── */

.orbit-path {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(var(--color-accent-raw, 184, 148, 62), 0.18);
  border-radius: 50%;
  pointer-events: none;
}

/* ── Central star ───────────────────────────────────────────────────── */

.central-star {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  margin-top: -10px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #fff9e6 0%,
    var(--color-accent, #b8943e) 40%,
    rgba(184, 148, 62, 0) 75%
  );
  box-shadow:
    0 0 12px 4px rgba(184, 148, 62, 0.6),
    0 0 28px 8px rgba(184, 148, 62, 0.25);
  z-index: 15;
}

/* ── Planet base ────────────────────────────────────────────────────── */

.planet {
  position: absolute;
  top: 50%;
  left: 50%;
  will-change: transform;
}

/* ── Tetrahedron — triangle via CSS border trick ────────────────────── */

.planet--tetrahedron {
  width: 0;
  height: 0;
  margin-left: -8px;
  margin-top: -7px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 14px solid var(--color-accent, #b8943e);
  filter: drop-shadow(0 0 4px rgba(184, 148, 62, 0.5));
}

/* ── Parallelepiped — skewed rectangle ──────────────────────────────── */

.planet--parallelepiped {
  width: 14px;
  height: 10px;
  margin-left: -7px;
  margin-top: -5px;
  background: var(--color-accent, #b8943e);
  transform-origin: center center;
  clip-path: polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%);
  filter: drop-shadow(0 0 4px rgba(184, 148, 62, 0.5));
}

/* ── Sphere — circle with radial gradient ───────────────────────────── */

.planet--sphere {
  width: 14px;
  height: 14px;
  margin-left: -7px;
  margin-top: -7px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 35%,
    #fff9e6 0%,
    var(--color-accent, #b8943e) 55%,
    rgba(184, 148, 62, 0.4) 100%
  );
  box-shadow: 0 0 6px 2px rgba(184, 148, 62, 0.35);
}

/* ── Octahedron — diamond (rotated square) ──────────────────────────── */

.planet--octahedron {
  width: 12px;
  height: 12px;
  margin-left: -6px;
  margin-top: -6px;
  background: var(--color-accent, #b8943e);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  filter: drop-shadow(0 0 4px rgba(184, 148, 62, 0.5));
}

@media (prefers-reduced-motion: reduce) {
  .planet {
    will-change: auto;
    transition: none !important;
    animation: none !important;
  }
}
</style>
