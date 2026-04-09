<template>
  <!--
    Moon Phase Progress Indicator
    Renders a single SVG moon that transitions through 4 phases:
    0 = New Moon (dark), 1 = Waxing Crescent, 2 = First Quarter, 3 = Full Moon + glow
    Uses GSAP state-object pattern for cross-platform animation (H5 + WeChat MP).
  -->
  <view class="moon-phase-container">
    <view class="moon-glow" :style="glowStyle" />
    <view class="moon-svg-wrap">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        class="moon-svg"
      >
        <!-- Outer ring (always visible, thin gold outline) -->
        <circle cx="50" cy="50" r="46" fill="none" stroke="#C8A850" stroke-width="1" opacity="0.35" />
        <!-- Moon lit surface -->
        <circle cx="50" cy="50" r="44" :fill="MOON_GOLD" />
        <!-- Shadow overlay: an ellipse whose rx animates to reveal the moon -->
        <ellipse
          cx="50" cy="50"
          :rx="shadowRx"
          ry="44"
          :fill="MOON_DARK"
        />
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * MoonPhase component
 * Props: phase (0-3) controls illumination.
 * GSAP animates the shadow ellipse rx from 44 (new moon) to 0 (full moon).
 * Glow breathing animation pulses on the current active phase.
 */
import { watch, ref, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'

const props = defineProps<{ phase: number }>()

// Design tokens matching Golden Dawn card art
const MOON_GOLD = '#C8A850'
const MOON_DARK = '#1E0F06'

// Shadow ellipse rx values for each phase
// 44 = full cover (new moon), 30 = crescent, 0 = half moon, -44 = full moon (shadow behind)
const PHASE_RX = [44, 28, 0, -44]

// GSAP state objects (plain JS, no Vue reactivity — MP safe)
const _moon = { rx: 44 }
const _glow = { opacity: 0, scale: 1 }

// Reactive style refs bound to template
const shadowRx = ref(44)
const glowStyle = ref('opacity: 0; transform: scale(1)')

let breathTween: gsap.core.Tween | null = null

function refreshMoon() {
  // rx can go negative to push shadow off screen for full moon
  shadowRx.value = Math.max(0, _moon.rx)
}

function refreshGlow() {
  glowStyle.value = `opacity: ${_glow.opacity}; transform: scale(${_glow.scale})`
}

function animateToPhase(target_phase: number) {
  const target_rx = PHASE_RX[target_phase] ?? 44

  gsap.to(_moon, {
    rx: target_rx,
    duration: 0.8,
    ease: 'power2.inOut',
    onUpdate: refreshMoon,
  })

  // Stop previous breathing
  if (breathTween) {
    breathTween.kill()
    breathTween = null
  }

  // Full moon gets a radiant glow; other phases get subtle breathing
  if (target_phase === 3) {
    // Expand glow for full moon reveal
    gsap.to(_glow, {
      opacity: 0.7,
      scale: 1.6,
      duration: 1.0,
      ease: 'power2.out',
      onUpdate: refreshGlow,
      onComplete: () => {
        // Then breathe
        breathTween = gsap.to(_glow, {
          opacity: 0.4,
          scale: 1.4,
          duration: 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          onUpdate: refreshGlow,
        })
      },
    })
  } else {
    // Subtle breathing for non-full phases
    gsap.to(_glow, {
      opacity: 0.2,
      scale: 1.1,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: refreshGlow,
      onComplete: () => {
        breathTween = gsap.to(_glow, {
          opacity: 0.05,
          scale: 1.0,
          duration: 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          onUpdate: refreshGlow,
        })
      },
    })
  }
}

watch(() => props.phase, (val) => {
  animateToPhase(val)
})

onMounted(() => {
  _moon.rx = PHASE_RX[props.phase] ?? 44
  refreshMoon()
  animateToPhase(props.phase)
})

onUnmounted(() => {
  if (breathTween) breathTween.kill()
  gsap.killTweensOf([_moon, _glow])
})
</script>

<style scoped>
.moon-phase-container {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Radial glow behind the moon */
.moon-glow {
  position: absolute;
  width: 160%;
  height: 160%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200, 168, 80, 0.6) 0%, rgba(200, 168, 80, 0) 70%);
  pointer-events: none;
  will-change: transform, opacity;
}

.moon-svg-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

.moon-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
