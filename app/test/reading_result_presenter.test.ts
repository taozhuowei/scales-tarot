// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  presentReadingResult,
  presentResultHero,
  presentCardDetail,
} from '../src/utils/reading/reading_result_presenter'
import type { ReadingResult, TarotCardInfo } from '../src/utils/tarot_reading'

function makeCard(overrides: Partial<TarotCardInfo> = {}): TarotCardInfo {
  return {
    id: 'the_star',
    name: '星星',
    nameEn: 'The Star',
    number: 17,
    type: 'major',
    image: '/test.jpg',
    upright: {
      keywords: ['希望', '疗愈', '灵感'],
      meaning: '正位含义描述',
      sentiment: 'positive',
    },
    reversed: {
      keywords: ['迟疑', '耗散'],
      meaning: '逆位含义描述',
      sentiment: 'negative',
    },
    ...overrides,
  }
}

function makeReadingResult(result: 'positive' | 'negative' = 'positive'): ReadingResult {
  const card = makeCard()
  return {
    result,
    score: result === 'positive' ? 5 : -5,
    cardDetails: [
      {
        card,
        position: result === 'positive' ? 'upright' : 'reversed',
        meaning: result === 'positive' ? card.upright.meaning : card.reversed.meaning,
      },
    ],
  }
}

describe('reading_result_presenter', () => {
  describe('presentCardDetail', () => {
    it('transforms upright card detail correctly', () => {
      const card = makeCard()
      const detail = presentCardDetail({
        card,
        position: 'upright',
        meaning: card.upright.meaning,
      })

      expect(detail.position).toBe('upright')
      expect(detail.positionLabel).toBe('正位')
      expect(detail.arcanaLabel).toBe('大阿尔卡那')
      expect(detail.keywords).toEqual(card.upright.keywords)
      expect(detail.meaning).toBe(card.upright.meaning)
    })

    it('transforms reversed card detail correctly', () => {
      const card = makeCard({ type: 'minor', suit: 'cups' })
      const detail = presentCardDetail({
        card,
        position: 'reversed',
        meaning: card.reversed.meaning,
      })

      expect(detail.position).toBe('reversed')
      expect(detail.positionLabel).toBe('逆位')
      expect(detail.arcanaLabel).toBe('小阿尔卡那')
      expect(detail.keywords).toEqual(card.reversed.keywords)
    })
  })

  describe('presentReadingResult', () => {
    it('transforms positive reading correctly', () => {
      const result = makeReadingResult('positive')
      const viewModel = presentReadingResult(result)

      expect(viewModel.result).toBe('positive')
      expect(viewModel.resultLabel).toBe('积极')
      expect(viewModel.toneClass).toBe('is-positive')
      expect(viewModel.resultStatement).toContain('积极')
      expect(viewModel.cardDetails).toHaveLength(1)
    })

    it('transforms negative reading correctly', () => {
      const result = makeReadingResult('negative')
      const viewModel = presentReadingResult(result)

      expect(viewModel.result).toBe('negative')
      expect(viewModel.resultLabel).toBe('消极')
      expect(viewModel.toneClass).toBe('is-negative')
      expect(viewModel.resultStatement).toContain('消极')
    })

    it('includes all card details', () => {
      const result = makeReadingResult('positive')
      result.cardDetails.push({
        card: makeCard({ id: 'the_moon', name: '月亮', nameEn: 'The Moon' }),
        position: 'upright',
        meaning: 'Second card meaning',
      })

      const viewModel = presentReadingResult(result)

      expect(viewModel.cardDetails).toHaveLength(2)
      expect(viewModel.cardDetails[0].card.name).toBe('星星')
      expect(viewModel.cardDetails[1].card.name).toBe('月亮')
    })
  })

  describe('presentResultHero', () => {
    it('transforms hero for positive result', () => {
      const result = makeReadingResult('positive')
      const hero = presentResultHero(result)

      expect(hero.eyebrow).toBe('占卜结果')
      expect(hero.title).toContain('积极')
      expect(hero.toneClass).toBe('is-positive')
    })

    it('includes question when provided', () => {
      const result = makeReadingResult('positive')
      const hero = presentResultHero(result, 'Will I succeed?')

      expect(hero.question).toBe('「Will I succeed?」')
    })

    it('excludes question when not provided', () => {
      const result = makeReadingResult('positive')
      const hero = presentResultHero(result)

      expect(hero.question).toBeUndefined()
    })
  })
})
