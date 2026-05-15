/**
 * Name: reading_result_presenter
 * Purpose: transform raw reading results into view-ready presentation data.
 * Reason: decouple raw API response format from UI rendering concerns.
 * Data flow: ReadingResult flows in; presentation view-model flows out.
 */

import type { ReadingResult, TarotCardInfo } from '../tarot_reading'

export interface CardDetailViewModel {
  card: TarotCardInfo
  position: 'upright' | 'reversed'
  meaning: string
  keywords: string[]
  positionLabel: string
  arcanaLabel: string
}

export interface ReadingResultViewModel {
  result: 'positive' | 'negative'
  resultLabel: string
  resultStatement: string
  toneClass: string
  cardDetails: CardDetailViewModel[]
}

export interface ResultHeroViewModel {
  eyebrow: string
  title: string
  question?: string
  toneClass: string
}

// Result type labels
const RESULT_LABELS: Record<ReadingResult['result'], string> = {
  positive: '积极',
  negative: '消极',
}

// Result statement templates
export function getResultStatement(result: ReadingResult['result']): string {
  return `塔罗牌根据您的问题呈现出${RESULT_LABELS[result]}的指示。`
}

// Summary lead text
const SUMMARY_LEAD_MAP: Record<ReadingResult['result'], string> = {
  positive: '当前牌面传递出积极信号',
  negative: '当前牌面传递出谨慎信号',
}

export function getSummaryText(readingResult: ReadingResult): string {
  const fragments = readingResult.cardDetails
    .map((detail) => detail.meaning)
    .map((meaning) => meaning.split(/[。？！]/)[0]?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 2)

  if (fragments.length === 0) {
    return SUMMARY_LEAD_MAP[readingResult.result]
  }

  return `${SUMMARY_LEAD_MAP[readingResult.result]}，${fragments.join('、')}`
}

// Tone classes for styling
function getToneClass(result: ReadingResult['result']): string {
  return result === 'positive' ? 'is-positive' : 'is-negative'
}

// Position labels
function getPositionLabel(position: 'upright' | 'reversed'): string {
  return position === 'upright' ? '正位' : '逆位'
}

// Arcana labels
function getArcanaLabel(type: 'major' | 'minor'): string {
  return type === 'major' ? '大阿尔卡那' : '小阿尔卡那'
}

// Keywords based on position
function getKeywords(
  detail: ReadingResult['cardDetails'][number],
): string[] {
  return detail.position === 'upright'
    ? detail.card.upright.keywords
    : detail.card.reversed.keywords
}

/**
 * Transform a card detail into view-model format.
 */
export function presentCardDetail(
  detail: ReadingResult['cardDetails'][number],
): CardDetailViewModel {
  return {
    card: detail.card,
    position: detail.position,
    meaning: detail.meaning,
    keywords: getKeywords(detail),
    positionLabel: getPositionLabel(detail.position),
    arcanaLabel: getArcanaLabel(detail.card.type),
  }
}

/**
 * Transform a ReadingResult into view-model format.
 */
export function presentReadingResult(result: ReadingResult): ReadingResultViewModel {
  return {
    result: result.result,
    resultLabel: RESULT_LABELS[result.result],
    resultStatement: getResultStatement(result.result),
    toneClass: getToneClass(result.result),
    cardDetails: result.cardDetails.map(presentCardDetail),
  }
}

/**
 * Transform hero section data.
 */
export function presentResultHero(
  result: ReadingResult,
  question?: string,
): ResultHeroViewModel {
  return {
    eyebrow: '占卜结果',
    title: getResultStatement(result.result),
    question: question ? `「${question}」` : undefined,
    toneClass: getToneClass(result.result),
  }
}
