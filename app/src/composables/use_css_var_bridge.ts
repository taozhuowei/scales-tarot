/**
 * Name: use_css_var_bridge
 * Purpose: bind every derived `ResponsiveSizes` value as a CSS custom
 *          property on the calling SFC's root element so any descendant
 *          scoped CSS can reference them via `var(--margin)` /
 *          `var(--header-height)` etc. without re-subscribing to the
 *          composable. `useResponsiveScale` is a module-level singleton,
 *          so the SFC that owns the page root is the only place that
 *          needs to call this for the bridge to work — descendants stay
 *          declarative.
 * Reason: extracted from `pages/main/index.vue` so the page setup body
 *          stays focused on phase + controllers + view picker. The
 *          variable list is the single source of truth for the bridge.
 * Data flow: useResponsiveScale().sizes ──▶ computed object of CSS
 *          custom properties ──▶ `:style="cssVarStyle"` on the root view.
 */
import { computed, type ComputedRef } from 'vue'
import { useResponsiveScale } from '../core/sizing/scale'

export function useCssVarBridge(): ComputedRef<Record<string, string>> {
  const { sizes } = useResponsiveScale()
  return computed(() => ({
    '--margin': `${sizes.value.margin}px`,
    '--gap': `${sizes.value.gap}px`,
    '--header-height': `${sizes.value.headerHeight}px`,
    '--drawer-min-height': `${sizes.value.drawerMinHeight}px`,
    '--action-area-height': `${sizes.value.actionAreaHeight}px`,
    '--font-xxl': `${sizes.value.fontXXL}px`,
    '--font-xl': `${sizes.value.fontXL}px`,
    '--font-l': `${sizes.value.fontL}px`,
    '--font-m': `${sizes.value.fontM}px`,
    '--font-s': `${sizes.value.fontS}px`,
    '--font-xs': `${sizes.value.fontXS}px`,
  }))
}
