/**
 * Name: composables/flows/index/use_active_view
 * Purpose: encapsulates the main page's view-picker state — the
 *          `showReadingView` gate (docs/prd/state.md（视图与应用级流程阶段的对应）) that overlays the reading
 *          split / drawer view on top of the divination view, and the
 *          `resultDrawerGeometry` used by the narrow-screen drawer view.
 * Reason: extracted from `pages/main/index.vue` (was 446 lines) so the
 *          phase → view selection logic stays in one composable. The
 *          page wires the returned refs/computed into its template
 *          instead of carrying the derivation inline.
 * Data flow: phase ref + window info ──▶ showReadingView,
 *          resultDrawerGeometry ──▶ template.
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import type { DrawerGeometry } from '../../../core/sizing/layout_solver'
import { solveLayoutFromWindow } from '../../../core/sizing/solve_from_window'
import type { DivinationPhase } from '../../../core/store/flow'

export interface UseActiveViewDeps {
  /** Application phase ref (provided by useAppPhase). */
  phase: Ref<DivinationPhase>
}

export interface ActiveView {
  /**
   * Reading-view gate (docs/prd/state.md（视图与应用级流程阶段的对应）): the reading split / drawer view
   * overlays the divination view only while the application is in
   * `reading` or `decision`. Idle and divination phases never show it.
   */
  showReadingView: ComputedRef<boolean>
  /**
   * Drawer geometry used by the narrow-screen reading view. Falls back
   * to a zero-sized geometry while the layout solver can't run (very
   * early lifecycle, before a window-info call succeeds).
   */
  resultDrawerGeometry: ComputedRef<DrawerGeometry>
}

const ZERO_DRAWER_GEOMETRY: DrawerGeometry = {
  initialTop: 0,
  initialHeight: 0,
  maxHeight: 0,
  width: 0,
  rightAligned: false,
}

export function useActiveView(deps: UseActiveViewDeps): ActiveView {
  const showReadingView = computed(
    () => deps.phase.value === 'reading' || deps.phase.value === 'decision',
  )

  const resultDrawerGeometry = computed<DrawerGeometry>(() => {
    try {
      return solveLayoutFromWindow('reading_stage').layout.drawer
    } catch {
      return ZERO_DRAWER_GEOMETRY
    }
  })

  return { showReadingView, resultDrawerGeometry }
}
