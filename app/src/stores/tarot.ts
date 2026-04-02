import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  drawThreeCards as drawCards,
  generateReading,
  loadAllCards,
  type DrawnResult,
  type ReadingResult,
  type TarotCardInfo
} from '../utils/tarotReading'

export type DivinationPhase = 'idle' | 'shuffling' | 'cutting' | 'drawing' | 'revealing' | 'result'

export const useTarotStore = defineStore('tarot', () => {
  const phase = ref<DivinationPhase>('idle')
  const drawnCards = ref<DrawnResult[]>([])
  const readingResult = ref<ReadingResult | null>(null)
  const allCards = ref<TarotCardInfo[]>(loadAllCards())
  const currentQuestion = ref('')

  const isIdle = computed(() => phase.value === 'idle')
  const isAnimating = computed(() => ['shuffling', 'cutting', 'drawing', 'revealing'].includes(phase.value))
  const isResultVisible = computed(() => phase.value === 'result' && readingResult.value !== null)

  function startDivination(question: string) {
    currentQuestion.value = question
    phase.value = 'shuffling'
    drawnCards.value = []
    readingResult.value = null
  }

  function setPhase(nextPhase: DivinationPhase) {
    phase.value = nextPhase
  }

  function revealResult() {
    phase.value = 'result'
  }

  function drawThreeCards(): DrawnResult[] {
    const drawn = drawCards(allCards.value)
    drawnCards.value = drawn
    readingResult.value = generateReading(drawn)
    return drawn
  }

  function getReadingResult(): ReadingResult | null {
    if (!readingResult.value && drawnCards.value.length > 0) {
      readingResult.value = generateReading(drawnCards.value)
    }

    return readingResult.value
  }

  function reset() {
    phase.value = 'idle'
    drawnCards.value = []
    readingResult.value = null
    currentQuestion.value = ''
  }

  return {
    phase,
    drawnCards,
    allCards,
    currentQuestion,
    isAnimating,
    isIdle,
    isResultVisible,
    readingResult,
    startDivination,
    setPhase,
    revealResult,
    drawThreeCards,
    getReadingResult,
    reset
  }
})
