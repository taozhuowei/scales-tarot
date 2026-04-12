/**
 * Name: overlay_viewport
 * Purpose: compute overlay viewport, safe-area, and result panel dimensions.
 * Reason: keep WeChat-safe spacing and result-zone height out of component and GSAP code.
 * Data flow: window metrics and menu button bounds flow in; stage/result/header metrics flow out.
 */

export interface OverlayMenuButtonRect {
  top: number
  height: number
}

export interface OverlayViewportInput {
  windowWidth: number
  windowHeight: number
  isWide: boolean
  showResults: boolean
  menuButtonRect?: OverlayMenuButtonRect | null
}

export interface OverlayViewportMetrics {
  topBarHeight: number
  headerBottom: number
  footerReserve: number
  stageWidth: number
  stageHeight: number
  stageContainerHeight: number
  resultHeight: number
}

const HEADER_ICON_SIZE_PX = 44
const STAGE_WIDTH_RATIO_WIDE = 0.44
const RESULT_STAGE_HEIGHT_RATIO = 0.42

/**
 * Resolve stage and result panel metrics for both H5 and WeChat mini program layouts.
 */
export function resolveOverlayViewport(input: OverlayViewportInput): OverlayViewportMetrics {
  const { windowWidth, windowHeight, isWide, showResults, menuButtonRect } = input
  const isMiniProgram = Boolean(menuButtonRect)
  const topBarHeight = menuButtonRect ? menuButtonRect.top + menuButtonRect.height + 8 : 0

  const headerMarginRpx = isMiniProgram
    ? (showResults ? 80 : 140)
    : (showResults ? 20 : 60)
  const footerReserveRpx = isMiniProgram ? 196 : 164

  const headerBottom = topBarHeight + toPx(headerMarginRpx, windowWidth) + HEADER_ICON_SIZE_PX
  const footerReserve = Math.max(48, toPx(footerReserveRpx, windowWidth))

  if (showResults) {
    if (isWide) {
      const stageWidth = Math.round(windowWidth * STAGE_WIDTH_RATIO_WIDE)
      return {
        topBarHeight,
        headerBottom,
        footerReserve,
        stageWidth,
        stageHeight: windowHeight,
        stageContainerHeight: windowHeight,
        resultHeight: windowHeight,
      }
    }

    const stageContainerHeight = Math.round(windowHeight * RESULT_STAGE_HEIGHT_RATIO)
    return {
      topBarHeight,
      headerBottom,
      footerReserve,
      stageWidth: windowWidth,
      stageHeight: stageContainerHeight,
      stageContainerHeight,
      resultHeight: Math.max(0, windowHeight - stageContainerHeight),
    }
  }

  return {
    topBarHeight,
    headerBottom,
    footerReserve,
    stageWidth: windowWidth,
    stageHeight: Math.max(0, windowHeight - topBarHeight),
    stageContainerHeight: windowHeight,
    resultHeight: 0,
  }
}

function toPx(rpx: number, windowWidth: number): number {
  return Math.round((rpx / 750) * windowWidth)
}
