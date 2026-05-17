/**
 * Name: use_header_presentation
 * Purpose: derive the top header region's variant + ARIA + slide-in style
 *          from the application phase and the animation controller:
 *            - idle      → role=banner, no aria-valuetext, no inline style
 *                          (TitleContent runs its own GSAP entrance)
 *            - non-idle  → role=progressbar, aria-valuetext=active step
 *                          label, headerStyle slide-in tween applied
 * Data flow: phase ref + animationController ──▶ reactive role / aria /
 *          style consumed by HeaderArea in pages/main/index.vue.
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import type { UseAnimationControllerReturn } from '../divination/use_animation_controller'
import type { DivinationPhase } from '../../../core/store/flow'

export interface HeaderPresentation {
  /** Idle gate — selects TitleContent vs ProgressContent + ARIA semantics. */
  isIdle: ComputedRef<boolean>
  /** `banner` in idle, `progressbar` in every divination phase. */
  headerRole: ComputedRef<'banner' | 'progressbar'>
  /**
   * Active progress step label (e.g. "审视" / "命定") surfaced as
   * aria-valuetext in non-idle phases; `undefined` in idle (no progress bar).
   */
  headerAriaValuetext: ComputedRef<string | undefined>
  /**
   * The GSAP slide-in tween style, bound only in non-idle phases. In idle
   * it must stay `undefined` — binding it would force the header off-screen
   * between render passes while TitleContent animates its own entrance.
   */
  headerStyle: ComputedRef<string | Record<string, string> | undefined>
}

export function useHeaderPresentation(
  phase: Ref<DivinationPhase>,
  animCtrl: UseAnimationControllerReturn,
): HeaderPresentation {
  const isIdle = computed(() => phase.value === 'idle')

  const headerRole = computed<'banner' | 'progressbar'>(() =>
    isIdle.value ? 'banner' : 'progressbar',
  )

  const headerAriaValuetext = computed<string | undefined>(() =>
    isIdle.value
      ? undefined
      : (animCtrl.progressHeaderPresentation.value.items.find((i) => i.isActive)?.label ?? ''),
  )

  const headerStyle = computed<string | Record<string, string> | undefined>(() =>
    isIdle.value ? undefined : animCtrl.headerStyle.value,
  )

  return { isIdle, headerRole, headerAriaValuetext, headerStyle }
}
