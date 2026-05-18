<template>
  <!--
    TitleContent — header slot payload for the idle / fallback views.
    Renders the heading copy described in docs/prd/view.md（容器与内容对应 #1）:
      - 'idle'     → 主标题 / 副标题 / 引导文字 with GSAP staggered entrance
      - 'fallback' → single neutral line "宇宙信号微弱，暂无法接通"

    Layout responsibility split (task 8.3.1):
      - Outer geometry (margin-top, height, safe-area, z-index, horizontal
        centring) lives on HeaderArea. This component renders ONLY the
        text payload and an inner top anchor that aligns the first line
        with ProgressContent's icon-top y so idle ↔ divination header
        swaps share a baseline.
  -->
  <view
    class="title-content"
    :class="`title-content--${variant}`"
  >
    <template v-if="variant === 'idle'">
      <text class="title-content__title font-display" :style="titleStyle">{{ COPY.idle.title }}</text>
      <text class="title-content__subtitle" :style="subtitleStyle">{{ COPY.idle.subtitle }}</text>
      <text class="title-content__guidance" :style="guidanceStyle">{{ COPY.idle.guidance }}</text>
      <text v-if="errorDetail" class="title-content__error">{{ errorDetail }}</text>
    </template>
    <template v-else-if="variant === 'fallback'">
      <text class="title-content__fallback">{{ COPY.fallback.line }}</text>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: TitleContent component
 * Purpose: render the heading copy (idle main/sub/guidance, or fallback
 *          single line) inside the shared HeaderArea shell. Owns its own
 *          GSAP staggered entrance for the idle variant and switches copy
 *          tables for the fallback variant.
 * Reason: split out from the legacy TitleArea (task 8.3.1) so the outer
 *         shell can be unified with ProgressContent. This component holds
 *         no outer-box geometry — only the text payload and an inner top
 *         anchor that aligns the first line with ProgressContent's icon
 *         top y. The anchor is content-intrinsic, not a layout decision.
 * Data flow: parent view picks the variant. Idle variant runs its own
 *            entrance timeline on mount (DOM-free state objects + style
 *            refs, identical to the legacy pattern). Reduced-motion users
 *            get the final state immediately.
 */
import { onUnmounted, ref, watch, onMounted } from 'vue'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../../core/utils/accessibility'

const props = withDefaults(
  defineProps<{
    variant?: 'idle' | 'fallback'
    /**
     * Optional secondary line for the idle error state. Rendered below
     * `guidance` so the user sees the resource error reason inline.
     */
    errorDetail?: string | null
  }>(),
  { variant: 'idle', errorDetail: null },
)

/** Static copy table — single source of truth for both variants. */
const COPY = {
  idle: {
    title: 'Scales Tarot',
    subtitle: '命运之轨 · 星辰之语',
    guidance: '轻触牌堆，聆听高维指引',
  },
  fallback: {
    line: '宇宙信号微弱，暂无法接通',
  },
} as const

/* ── DOM-free animation state (MP-WeChat compatible) ──────────────── */

const titleStyle = ref<Record<string, string>>({})
const subtitleStyle = ref<Record<string, string>>({})
const guidanceStyle = ref<Record<string, string>>({})

const _title = { y: 20, opacity: 0 }
const _subtitle = { y: 20, opacity: 0 }
const _guidance = { y: 20, opacity: 0 }

function flushHeaderStyles() {
  titleStyle.value = {
    transform: `translateY(${_title.y}px)`,
    opacity: String(_title.opacity),
  }
  subtitleStyle.value = {
    transform: `translateY(${_subtitle.y}px)`,
    opacity: String(_subtitle.opacity),
  }
  guidanceStyle.value = {
    transform: `translateY(${_guidance.y}px)`,
    opacity: String(_guidance.opacity),
  }
}

function runEntranceAnimation() {
  if (props.variant !== 'idle') return

  // Reset DOM-free state every run so re-mount or variant flip starts fresh.
  _title.y = 20; _title.opacity = 0
  _subtitle.y = 20; _subtitle.opacity = 0
  _guidance.y = 20; _guidance.opacity = 0
  flushHeaderStyles()

  if (prefersReducedMotion()) {
    _title.y = 0; _title.opacity = 1
    _subtitle.y = 0; _subtitle.opacity = 1
    _guidance.y = 0; _guidance.opacity = 1
    flushHeaderStyles()
    return
  }

  const tl = gsap.timeline()
  tl.to(_title, {
    y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: flushHeaderStyles,
  })
    .to(_subtitle, {
      y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: flushHeaderStyles,
    }, 0.08)
    .to(_guidance, {
      y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: flushHeaderStyles,
    }, 0.16)
}

onMounted(() => {
  runEntranceAnimation()
})

// If the parent flips variant at runtime (e.g. fallback → idle on retry),
// re-run the entrance so the user sees a fresh fade-in instead of the
// stale opacity-0 state from the previous variant.
watch(() => props.variant, () => { runEntranceAnimation() })

onUnmounted(() => {
  gsap.killTweensOf(_title)
  gsap.killTweensOf(_subtitle)
  gsap.killTweensOf(_guidance)
})
</script>

<style scoped>
.title-content {
  /* Inner flex column for stacking title / subtitle / guidance. The
     outer HeaderArea provides the box (margin, height, horizontal
     centre); this component handles the per-variant vertical stack. */
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 4px;
  text-align: center;

  /* Anchor the first text line at the same y as ProgressContent's
     44px-icon top, so idle and divination headers visually share a
     baseline. Progress icons are 44px centred in HeaderArea's
     `--header-height` slot, so their top sits at
     (var(--header-height) - 44px) / 2 from the slot's top edge.
     Mirroring that here is the legacy approach (preserved across the
     8.3.1 refactor) and is intrinsic to the text-stack content type —
     it would not make sense in HeaderArea, which serves both content
     types and must stay variant-agnostic. */
  padding-top: calc((var(--header-height) - 44px) / 2);
  box-sizing: border-box;
}

.title-content__title {
  font-size: var(--font-xxl);
  color: var(--color-text-primary);
  letter-spacing: 0.18em;
  text-shadow: 0 4rpx 12rpx rgba(74, 37, 16, 0.1);
  line-height: 1;
}

.title-content__subtitle {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  line-height: 1.2;
}

.title-content__guidance {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.title-content__error {
  font-size: var(--font-xs);
  color: var(--color-no);
  letter-spacing: 0.04em;
  max-width: 80%;
  word-break: break-word;
  line-height: 1.2;
}

.title-content__fallback {
  font-size: var(--font-s);
  color: var(--color-text-secondary);
  letter-spacing: 0.18em;
}
</style>
