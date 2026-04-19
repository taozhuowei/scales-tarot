/**
 * Name: typewriter_model
 * Purpose: pure typewriter animation logic - timer management and character progression.
 * Reason: allows typewriter effect to be tested and swapped independently from rendering.
 * Data flow: text and timing config flow in; display state updates flow out via callbacks.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { prefersReducedMotion } from '../accessibility'

export interface TypewriterConfig {
  text: string
  startDelay?: number
  charInterval?: number
  instant?: boolean
}

export interface TypewriterCallbacks {
  onUpdate: (displayedText: string, isComplete: boolean) => void
  onComplete: () => void
}

export interface TypewriterModel {
  start(): void
  stop(): void
  reset(): void
  isRunning(): boolean
}

export function createTypewriterModel(
  config: TypewriterConfig,
  callbacks: TypewriterCallbacks,
): TypewriterModel {
  const { text, startDelay = 0, charInterval = 28, instant = false } = config
  const fullText = text ?? ''

  let startTimer: ReturnType<typeof setTimeout> | null = null
  let tickTimer: ReturnType<typeof setTimeout> | null = null
  let currentIndex = 0
  let isRunningFlag = false

  function clearTimers(): void {
    if (startTimer) {
      clearTimeout(startTimer)
      startTimer = null
    }
    if (tickTimer) {
      clearTimeout(tickTimer)
      tickTimer = null
    }
  }

  function prefersReducedMotion(): boolean {
    // #ifdef H5
      /* eslint-disable no-restricted-globals */
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
      /* eslint-enable no-restricted-globals */
    // #endif
    return false
  }

  function complete(): void {
    isRunningFlag = false
    callbacks.onUpdate(fullText, true)
    callbacks.onComplete()
  }

  function tick(): void {
    currentIndex += 1
    const displayedText = fullText.slice(0, currentIndex)
    const isComplete = currentIndex >= fullText.length

    callbacks.onUpdate(displayedText, isComplete)

    if (isComplete) {
      isRunningFlag = false
      callbacks.onComplete()
      return
    }

    tickTimer = setTimeout(tick, charInterval)
  }

  function start(): void {
    clearTimers()

    if (!fullText) {
      callbacks.onUpdate('', true)
      callbacks.onComplete()
      return
    }

    if (instant || prefersReducedMotion()) {
      currentIndex = fullText.length
      complete()
      return
    }

    currentIndex = 0
    isRunningFlag = true
    callbacks.onUpdate('', false)

    startTimer = setTimeout(tick, startDelay)
  }

  function stop(): void {
    clearTimers()
    isRunningFlag = false
  }

  function reset(): void {
    clearTimers()
    currentIndex = 0
    isRunningFlag = false
    callbacks.onUpdate('', false)
  }

  function isRunning(): boolean {
    return isRunningFlag
  }

  return {
    start,
    stop,
    reset,
    isRunning,
  }
}

/**
 * Calculate staggered delays for result panel fields.
 */
export interface TypewriterFieldTiming {
  startDelay: number
  charInterval: number
}

export function calculateFieldTiming(
  cardIndex: number,
  fieldStep: number,
  baseDelay: number = 620,
  cardDelay: number = 320,
  stepDelay: number = 90,
): TypewriterFieldTiming {
  return {
    startDelay: baseDelay + cardIndex * cardDelay + fieldStep * stepDelay,
    charInterval: 24,
  }
}

export function calculateKeywordTiming(
  cardIndex: number,
  keywordIndex: number,
  baseDelay: number = 620,
  cardDelay: number = 320,
  keywordDelay: number = 70,
): TypewriterFieldTiming {
  const field4Delay = baseDelay + cardIndex * cardDelay + 3 * 90
  return {
    startDelay: field4Delay + 90 + keywordIndex * keywordDelay,
    charInterval: 20,
  }
}
