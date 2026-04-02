import { describe, expect, it } from 'vitest'
import { getResultStatement, getSummaryText } from '../src/utils/result_panel'
import type { ReadingResult } from '../src/utils/tarotReading'

describe('result_panel utils', () => {
  it('returns proper result statements', () => {
    expect(getResultStatement('yes')).toBe('塔罗牌根据您的问题呈现出积极的指示。')
    expect(getResultStatement('no')).toBe('塔罗牌根据您的问题呈现出消极的指示。')
    expect(getResultStatement('uncertain')).toBe('塔罗牌根据您的问题呈现出尚不明朗的指示。')
  })

  it('returns proper summary text joining meanings', () => {
    const mockReading: ReadingResult = {
      result: 'yes',
      cardDetails: [
        {
          card: {} as any,
          position: 'upright',
          meaning: '这是第一句的意义，包含很长一段'
        },
        {
          card: {} as any,
          position: 'upright',
          meaning: '这是第二句！很感叹'
        },
        {
          card: {} as any,
          position: 'upright',
          meaning: '这是第三句，不应该出现'
        }
      ]
    }
    const summary = getSummaryText(mockReading)
    // Should take the first sentence of the first two cards
    expect(summary).toBe('当前牌面传递出积极信号，这是第一句的意义，包含很长一段、这是第二句')
  })

  it('handles empty card meanings gracefully', () => {
    const mockReading: ReadingResult = {
      result: 'uncertain',
      cardDetails: []
    }
    const summary = getSummaryText(mockReading)
    expect(summary).toBe('当前牌面信息仍不明朗')
  })
})
