/**
 * Name: utils/dev/draggable_panel
 * Purpose: H5-only drag controller for the DevToolsPanel collapsed handle.
 *          Owns mouse/touch listeners, position state mutation through a
 *          caller-provided setter, and the click-vs-drag discrimination
 *          that lets the same surface act as both a drag handle and a
 *          toggle button.
 * Reason: extracted from DevToolsPanel.vue so the SFC body doesn't need
 *          to host browser-only APIs (window, MouseEvent, TouchEvent),
 *          which would force eslint disables for `no-restricted-globals`
 *          throughout the script. The same trick is used by
 *          `utils/dev/container_borders.ts`: H5-only behaviour lives
 *          behind uni-app's H5 conditional-compile gate, so mp-weixin
 *          builds compile out the implementation entirely.
 *
 * Platform behavior:
 *   - H5: full mouse + touch drag with viewport clamping.
 *   - mp-weixin: every browser-touching helper compiles out under the
 *     H5 conditional-compile gate. The factory still returns a
 *     controller object so callers don't need to branch on platform;
 *     methods become no-ops.
 */

const HANDLE_SIZE_PX = 40
const CLICK_TOLERANCE_PX = 5
const DEFAULT_MARGIN_PX = 12

export interface Position {
  x: number
  y: number
}

export interface ViewportMetrics {
  width: number
  height: number
  safeBottom: number
}

export interface DraggablePanelOptions {
  /** Called with the next clamped position whenever the drag moves. */
  setPosition: (next: Position) => void
  /** Source-of-truth position read at drag start. */
  getPosition: () => Position
  /** Called when the gesture ends with `{ wasDrag: true }` if total
   *  movement exceeded CLICK_TOLERANCE_PX, so the caller can swallow the
   *  trailing synthetic click and avoid toggling the panel mid-drag. */
  onDragEnd: (info: { wasDrag: boolean }) => void
  /** Called when the gesture begins so the caller can mark dragging. */
  onDragStart: () => void
}

export interface DraggablePanelController {
  /** Compute the default bottom-right anchor for first paint. */
  defaultPosition: () => Position
  /** Begin a drag from a mouse press. Pass the native MouseEvent. */
  startMouseDrag: (event: MouseEvent) => void
  /** Begin a drag from a touch start. Pass the native TouchEvent. */
  startTouchDrag: (event: TouchEvent) => void
  /** Detach any in-flight global listeners (call in onBeforeUnmount). */
  dispose: () => void
}

// #ifdef H5
/* eslint-disable no-restricted-globals, no-restricted-properties -- reason: H5-only drag controller; window/document access is gated by uniapp's H5 conditional-compile directive so mp-weixin builds compile this branch out. The DevToolsPanel that consumes it is itself dev-only (gated by import.meta.env.DEV). */

/** Mutable state shared between gesture handlers within a single
 *  controller instance. Kept as a struct so the helpers below can be
 *  module-scope (small, single-responsibility) instead of nested closures. */
interface GestureState {
  dragStartX: number
  dragStartY: number
  panelStartX: number
  panelStartY: number
  totalDelta: number
  active: boolean
}

function readViewport(): ViewportMetrics {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, safeBottom: 0 }
  }
  const safeBottomCss = getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-area-inset-bottom')
    .trim()
  const safeBottom = safeBottomCss.endsWith('px')
    ? parseFloat(safeBottomCss) || 0
    : 0
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    safeBottom,
  }
}

function clampToViewport(x: number, y: number): Position {
  const { width, height, safeBottom } = readViewport()
  const maxX = Math.max(0, width - HANDLE_SIZE_PX)
  const maxY = Math.max(0, height - HANDLE_SIZE_PX - safeBottom)
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  }
}

function bottomRightDefault(): Position {
  const { width, height, safeBottom } = readViewport()
  return {
    x: Math.max(0, width - HANDLE_SIZE_PX - DEFAULT_MARGIN_PX),
    y: Math.max(0, height - HANDLE_SIZE_PX - safeBottom - DEFAULT_MARGIN_PX),
  }
}

function beginGesture(
  state: GestureState,
  opts: DraggablePanelOptions,
  clientX: number,
  clientY: number,
) {
  const start = opts.getPosition()
  state.dragStartX = clientX
  state.dragStartY = clientY
  state.panelStartX = start.x
  state.panelStartY = start.y
  state.totalDelta = 0
  state.active = true
  opts.onDragStart()
}

function updateGesture(
  state: GestureState,
  opts: DraggablePanelOptions,
  clientX: number,
  clientY: number,
) {
  if (!state.active) return
  const dx = clientX - state.dragStartX
  const dy = clientY - state.dragStartY
  state.totalDelta = Math.max(state.totalDelta, Math.hypot(dx, dy))
  opts.setPosition(clampToViewport(state.panelStartX + dx, state.panelStartY + dy))
}

function endGesture(state: GestureState, opts: DraggablePanelOptions) {
  if (!state.active) return
  state.active = false
  opts.onDragEnd({ wasDrag: state.totalDelta > CLICK_TOLERANCE_PX })
}

function bindMouseHandlers(
  state: GestureState,
  opts: DraggablePanelOptions,
): { start: (e: MouseEvent) => void; detach: () => void } {
  const onMove = (e: MouseEvent) => updateGesture(state, opts, e.clientX, e.clientY)
  const onUp = () => {
    endGesture(state, opts)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  return {
    start(e) {
      // Left-button only; right-clicks shouldn't begin a drag.
      if (e.button !== 0) return
      beginGesture(state, opts, e.clientX, e.clientY)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    detach() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    },
  }
}

function bindTouchHandlers(
  state: GestureState,
  opts: DraggablePanelOptions,
): { start: (e: TouchEvent) => void; detach: () => void } {
  const onMove = (e: TouchEvent) => {
    if (!state.active) return
    // Block native scroll once the drag is genuine, so the page doesn't
    // scroll under the dragging finger on mobile.
    if (state.totalDelta > CLICK_TOLERANCE_PX) e.preventDefault()
    const t = e.touches[0]
    if (!t) return
    updateGesture(state, opts, t.clientX, t.clientY)
  }
  const onEnd = () => {
    endGesture(state, opts)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
    window.removeEventListener('touchcancel', onEnd)
  }
  return {
    start(e) {
      const t = e.touches[0]
      if (!t) return
      beginGesture(state, opts, t.clientX, t.clientY)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
      window.addEventListener('touchcancel', onEnd)
    },
    detach() {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    },
  }
}
/* eslint-enable no-restricted-globals, no-restricted-properties */
// #endif

/**
 * Build a controller that owns the drag plumbing. The caller spreads the
 * returned `startMouseDrag` / `startTouchDrag` onto the handle's @mousedown
 * / @touchstart bindings; everything else (window listeners, clamping,
 * click tolerance) is internal.
 */
export function createDraggablePanel(
  opts: DraggablePanelOptions,
): DraggablePanelController {
  // #ifdef H5
  const state: GestureState = {
    dragStartX: 0,
    dragStartY: 0,
    panelStartX: 0,
    panelStartY: 0,
    totalDelta: 0,
    active: false,
  }
  const mouse = bindMouseHandlers(state, opts)
  const touch = bindTouchHandlers(state, opts)
  return {
    defaultPosition: bottomRightDefault,
    startMouseDrag: mouse.start,
    startTouchDrag: touch.start,
    dispose() {
      mouse.detach()
      touch.detach()
    },
  }
  // #endif

  // #ifndef H5
  // mp-weixin fallback: dev panel drag is H5-only; provide a no-op controller
  // so the consumer doesn't need to branch on platform.
  return {
    defaultPosition: () => ({ x: 0, y: 0 }),
    startMouseDrag: () => {},
    startTouchDrag: () => {},
    dispose: () => {},
  }
  // #endif
}
