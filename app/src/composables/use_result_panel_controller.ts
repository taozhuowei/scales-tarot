/**
 * Name: use_result_panel_controller
 * Purpose: provide presentation-ready data for result panel rendering.
 * Reason: separate result data transformation from UI rendering.
 * Data flow: reading result flows in; view-model data flows out.
 */

import { computed } from 'vue'
import type { ReadingResult } from '../utils/tarotReading'
import {
  presentReadingResult,
  presentResultHero,
  type ResultHeroViewModel,
  type CardDetailViewModel,
} from '../utils/reading/reading_result_presenter'
import {
  calculateFieldTiming,
  calculateKeywordTiming,
  type TypewriterFieldTiming,
} from '../utils/typing/typewriter_model'

export interface UseResultPanelControllerProps {
  readingResult: ReadingResult
  question?: string
}

export interface ResultPanelViewModel {
  // Hero section
  hero: ResultHeroViewModel

  // Result styling
  toneClass: string

  // Card details with timing
  cardDetails: Array<CardDetailViewModel & {
    nameTiming: TypewriterFieldTiming
    nameEnTiming: TypewriterFieldTiming
    positionTiming: TypewriterFieldTiming
    arcanaTiming: TypewriterFieldTiming
    meaningTiming: TypewriterFieldTiming
    keywordsWithTiming: Array<{
      text: string
      timing: TypewriterFieldTiming
    }>
  }>

  // Eyebrow timing
  eyebrowTiming: TypewriterFieldTiming
}

export function useResultPanelController(props: UseResultPanelControllerProps): ResultPanelViewModel {
  const readingViewModel = computed(() => presentReadingResult(props.readingResult))
  const heroViewModel = computed(() => presentResultHero(props.readingResult, props.question))

  const cardDetails = computed(() => {
    return readingViewModel.value.cardDetails.map((detail, index) => ({
      ...detail,
      nameTiming: calculateFieldTiming(index, 0),
      nameEnTiming: calculateFieldTiming(index, 1),
      positionTiming: calculateFieldTiming(index, 2),
      arcanaTiming: calculateFieldTiming(index, 3),
      meaningTiming: calculateFieldTiming(index, 4),
      keywordsWithTiming: detail.keywords.map((keyword, keywordIndex) => ({
        text: keyword,
        timing: calculateKeywordTiming(index, keywordIndex),
      })),
    }))
  })

  const eyebrowTiming: TypewriterFieldTiming = {
    startDelay: 40,
    charInterval: 44,
  }

  return {
    hero: heroViewModel.value,
    toneClass: readingViewModel.value.toneClass,
    cardDetails: cardDetails.value,
    eyebrowTiming,
  }
}

export function useTypewriterController(
  text: string,
  startDelay: number,
  charInterval: number,
) {
  return {
    text,
    startDelay,
    charInterval,
  }
}
