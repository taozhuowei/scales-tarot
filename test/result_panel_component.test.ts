// @vitest-environment jsdom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResultPanel from '../app/src/components/ResultPanel.vue'
import type { ReadingResult, TarotCardInfo } from '../app/src/utils/tarotReading'

function makeCard(): TarotCardInfo {
  return {
    id: 'the_star',
    name: '星星',
    nameEn: 'The Star',
    number: 17,
    type: 'major',
    image: 'http://localhost:3000/static/themes/golden_dawn/tarot/major/major_arcana_17_the_star.jpeg',
    upright: {
      keywords: ['希望', '疗愈'],
      meaning: '正位含义',
      sentiment: 'positive',
    },
    reversed: {
      keywords: ['迟疑', '耗散'],
      meaning: '逆位含义',
      sentiment: 'negative',
    },
  }
}

function makeReadingResult(result: ReadingResult['result']): ReadingResult {
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

const typewriterStub = {
  name: 'TypewriterText',
  props: ['text'],
  template: '<span class="typewriter-stub">{{ text }}</span>',
}

describe('ResultPanel component', () => {
  it('applies positive tone classes for positive readings', () => {
    const wrapper = shallowMount(ResultPanel, {
      props: {
        readingResult: makeReadingResult('positive'),
      },
      global: {
        stubs: {
          TypewriterText: typewriterStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="result-shell"]').classes()).toContain('is-positive')
    expect(wrapper.find('.hero-title').classes()).toContain('is-positive')
  })

  it('applies negative tone classes for negative readings', () => {
    const wrapper = shallowMount(ResultPanel, {
      props: {
        readingResult: makeReadingResult('negative'),
      },
      global: {
        stubs: {
          TypewriterText: typewriterStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="result-shell"]').classes()).toContain('is-negative')
    expect(wrapper.find('.hero-title').classes()).toContain('is-negative')
  })
})
