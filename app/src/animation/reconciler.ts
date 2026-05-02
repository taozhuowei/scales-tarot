/**
 * Name: animation/reconciler
 * Purpose: synchronize GSAP-mutated state objects into Vue style refs.
 * Reason: decouple style computation and watch bindings from raw state management.
 */

import { computed, ref, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { SceneLayout as SceneLayoutResult } from '../core/sizing/layout_solver'
import type { AnimationState } from './state'

export interface StyleReconcilerOptions {
  shuffleHalfCount: number
  maxCutPiles: number
  maxCardCount: number
}

export interface StyleReconciler {
  layoutCardWidth: Ref<number>
  layoutCardHeight: Ref<number>
  bgStyle: Ref<Record<string, string>>
  stageStyle: Ref<Record<string, string>>
  headerStyle: Ref<Record<string, string>>
  footerStyle: Ref<Record<string, string>>
  deckCtnStyle: Ref<Record<string, string>>
  initialsStyle: Ref<Record<string, string>[]>
  leftsStyle: Ref<Record<string, string>[]>
  rightsStyle: Ref<Record<string, string>[]>
  pilesStyle: Ref<Record<string, string>[]>
  drawsStyle: Ref<Record<string, string>[]>
  drawsSizeStyle: Ref<{ width: string; height: string }[]>
  innersStyle: Ref<Record<string, string>[]>
  overlayVarsStyle: ComputedRef<string>
  refreshBg(): void
  refreshStage(): void
  refreshHeader(): void
  refreshFooter(): void
  refreshDeckCtn(): void
  refreshInitials(): void
  refreshLefts(): void
  refreshRights(): void
  refreshPiles(): void
  refreshDraws(): void
  refreshInners(): void
  setDrawCardSizes(layout: SceneLayoutResult): void
}

function _cardStyleObj(state: {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number
  opacity: number
}): Record<string, string> {
  const scaleY = state.scaleY !== 1 ? ` scaleY(${state.scaleY})` : ''
  return {
    transform: `translateX(${state.x}px) translateY(${state.y}px) rotate(${state.rotation}deg) scale(${state.scale})${scaleY}`,
    opacity: String(state.opacity),
  }
}

function _centerStyleObj(state: {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
}): Record<string, string> {
  return {
    transform: `translateX(calc(-50% + ${state.x}px)) translateY(calc(-50% + ${state.y}px)) rotate(${state.rotation}deg) scale(${state.scale})`,
    opacity: String(state.opacity),
    zIndex: String(state.zIndex),
  }
}

function _innerStyleObj(state: { rotationY: number }): Record<string, string> {
  return { transform: `rotateY(${state.rotationY}deg)` }
}

export function createStyleReconciler(
  state: AnimationState,
  opts: StyleReconcilerOptions,
): StyleReconciler {
  const layoutCardWidth = ref(172)
  const layoutCardHeight = ref(275)

  const bgStyle = ref<Record<string, string>>({ opacity: '0' })
  const stageStyle = ref<Record<string, string>>({})
  const headerStyle = ref<Record<string, string>>({
    transform: 'translateY(60px)',
    opacity: '0',
  })
  const footerStyle = ref<Record<string, string>>({
    transform: 'translateY(60px)',
    opacity: '0',
  })
  const deckCtnStyle = ref<Record<string, string>>({})

  const initialsStyle = ref<Record<string, string>[]>(
    state.initials.map((_, i) => ({ transform: `translateY(${-i * 0.8}px)` })),
  )
  const leftsStyle = ref<Record<string, string>[]>(
    Array.from({ length: opts.shuffleHalfCount }, () => ({})),
  )
  const rightsStyle = ref<Record<string, string>[]>(
    Array.from({ length: opts.shuffleHalfCount }, () => ({})),
  )
  const pilesStyle = ref<Record<string, string>[]>(Array(opts.maxCutPiles).fill({}))
  const drawsStyle = ref<Record<string, string>[]>(Array(opts.maxCardCount).fill({}))
  const drawsSizeStyle = ref<{ width: string; height: string }[]>(
    Array.from({ length: opts.maxCardCount }, () => ({ width: '', height: '' })),
  )
  const innersStyle = ref<Record<string, string>[]>(Array(opts.maxCardCount).fill({}))

  const overlayVarsStyle = computed(() =>
    `--card-width: ${layoutCardWidth.value}px; --card-height: ${layoutCardHeight.value}px`,
  )

  const refreshBg = () => {
    bgStyle.value = { opacity: String(state.bg.opacity) }
  }
  const refreshStage = () => {
    stageStyle.value = { transform: `translateY(${state.stage.y}px)` }
  }
  const refreshHeader = () => {
    headerStyle.value = {
      transform: `translateY(${state.header.y}px)`,
      opacity: String(state.header.opacity),
    }
  }
  const refreshFooter = () => {
    footerStyle.value = {
      transform: `translateY(${state.footer.y}px)`,
      opacity: String(state.footer.opacity),
    }
  }
  const refreshDeckCtn = () => {
    deckCtnStyle.value = { transform: `translateX(${state.deckCtn.x}px)` }
  }
  const refreshInitials = () => {
    initialsStyle.value = state.initials.map(_cardStyleObj)
  }
  const refreshLefts = () => {
    leftsStyle.value = state.lefts.map(_cardStyleObj)
  }
  const refreshRights = () => {
    rightsStyle.value = state.rights.map(_cardStyleObj)
  }
  const refreshPiles = () => {
    pilesStyle.value = state.piles.map(_centerStyleObj)
  }
  const refreshDraws = () => {
    drawsStyle.value = state.draws.map(_centerStyleObj)
    drawsSizeStyle.value = state.draws.map((d) => ({
      width: `${d.width}px`,
      height: `${d.height}px`,
    }))
  }
  const refreshInners = () => {
    innersStyle.value = state.inners.map(_innerStyleObj)
  }

  function setDrawCardSizes(layout: SceneLayoutResult) {
    state.draws.forEach((d, index) => {
      const card = layout.cards[index]
      d.width = card?.width ?? layout.cardWidth
      d.height = card?.height ?? layout.cardHeight
    })
    layoutCardWidth.value = layout.cardWidth
    layoutCardHeight.value = layout.cardHeight
  }

  // Automatic style refresh: when GSAP mutates the plain state objects,
  // Vue watch(deep: true) tracks property mutations and triggers the corresponding refresh callbacks.
  watch(() => state.bg, refreshBg, { deep: true, immediate: true })
  watch(() => state.stage, refreshStage, { deep: true, immediate: true })
  watch(() => state.header, refreshHeader, { deep: true, immediate: true })
  watch(() => state.footer, refreshFooter, { deep: true, immediate: true })
  watch(() => state.deckCtn, refreshDeckCtn, { deep: true, immediate: true })
  watch(() => state.initials, refreshInitials, { deep: true, immediate: true })
  watch(() => state.lefts, refreshLefts, { deep: true, immediate: true })
  watch(() => state.rights, refreshRights, { deep: true, immediate: true })
  watch(() => state.piles, refreshPiles, { deep: true, immediate: true })
  watch(() => state.draws, refreshDraws, { deep: true, immediate: true })
  watch(() => state.inners, refreshInners, { deep: true, immediate: true })

  return {
    layoutCardWidth,
    layoutCardHeight,
    bgStyle,
    stageStyle,
    headerStyle,
    footerStyle,
    deckCtnStyle,
    initialsStyle,
    leftsStyle,
    rightsStyle,
    pilesStyle,
    drawsStyle,
    drawsSizeStyle,
    innersStyle,
    overlayVarsStyle,
    refreshBg,
    refreshStage,
    refreshHeader,
    refreshFooter,
    refreshDeckCtn,
    refreshInitials,
    refreshLefts,
    refreshRights,
    refreshPiles,
    refreshDraws,
    refreshInners,
    setDrawCardSizes,
  }
}
