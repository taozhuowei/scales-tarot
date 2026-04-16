/**
 * Name: core/viewport/viewport_metrics
 * Purpose: resolve raw viewport metrics across H5 and mini-program environments.
 * Reason: centralise platform-specific window info extraction into a single pure-ish helper.
 */

import type { ViewportMetrics } from './types'

/**
 * Resolve the current viewport metrics.
 * H5: uses window.innerWidth / innerHeight.
 * Mini-program: falls back to uni.getSystemInfoSync() when window globals are absent.
 */
export function resolveViewportMetrics(): ViewportMetrics {
  // #ifdef H5
  if (typeof window !== 'undefined') {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      dpr: window.devicePixelRatio || 1,
    }
  }
  // #endif

  // #ifndef H5
  try {
    const info = uni.getSystemInfoSync()
    const safeAreaBottomRaw = info.safeArea?.bottom
    return {
      width: info.windowWidth ?? info.screenWidth ?? 0,
      height: info.windowHeight ?? info.screenHeight ?? 0,
      safeAreaTop: info.safeArea?.top ?? 0,
      safeAreaBottom: safeAreaBottomRaw && safeAreaBottomRaw > 0
        ? (info.screenHeight ?? 0) - safeAreaBottomRaw
        : 0,
      dpr: info.pixelRatio ?? 1,
    }
  } catch {
    return { width: 375, height: 812, safeAreaTop: 0, safeAreaBottom: 0, dpr: 2 }
  }
  // #endif

  return { width: 375, height: 812, safeAreaTop: 0, safeAreaBottom: 0, dpr: 2 }
}
