import cupsData from '../data/tarot-cups.json'
import majorData from '../data/tarot-major.json'
import pentaclesData from '../data/tarot-pentacles.json'
import swordsData from '../data/tarot-swords.json'
import wandsData from '../data/tarot-wands.json'

export interface TarotCardMeaning {
  keywords: string[]
  meaning: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface TarotCardInfo {
  id: string
  name: string
  nameEn: string
  number: number
  type: 'major' | 'minor'
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles'
  image: string
  upright: TarotCardMeaning
  reversed: TarotCardMeaning
}

export interface DrawnResult {
  card: TarotCardInfo
  position: 'upright' | 'reversed'
}

export interface ReadingResult {
  result: 'yes' | 'no' | 'uncertain'
  cardDetails: Array<{
    card: TarotCardInfo
    position: 'upright' | 'reversed'
    meaning: string
  }>
}

type TarotCardSeed = Omit<TarotCardInfo, 'image'> & {
  image?: string
}

function normalizeCard(seed: TarotCardSeed): TarotCardInfo {
  return {
    ...seed,
    image: getCardImagePath(seed)
  }
}

export function loadAllCards(): TarotCardInfo[] {
  const seeds: TarotCardSeed[] = [
    ...(majorData.majorArcana as TarotCardSeed[]),
    ...(wandsData.wands.cards as TarotCardSeed[]),
    ...(cupsData.cups.cards as TarotCardSeed[]),
    ...(swordsData.swords.cards as TarotCardSeed[]),
    ...(pentaclesData.pentacles.cards as TarotCardSeed[])
  ]

  return seeds.map(normalizeCard)
}

function getCardImagePath(card: TarotCardSeed): string {
  const theme_id = 'golden_dawn'

  if (card.type === 'major') {
    return `/static/themes/${theme_id}/tarot/major/major_arcana_${String(card.number).padStart(2, '0')}_${card.id}.jpeg`
  }

  const suit = card.suit ?? ''
  const number_text = String(card.number).padStart(2, '0')
  const formatted_name = card.nameEn.toLowerCase().replace(/\s+/g, '_')

  return `/static/themes/${theme_id}/tarot/minor/${suit}/minor_arcana_${suit}_${number_text}_${formatted_name}.jpeg`
}

export function drawThreeCards(allCards: TarotCardInfo[]): DrawnResult[] {
  const shuffled_cards = [...allCards].sort(() => Math.random() - 0.5)

  return shuffled_cards.slice(0, 3).map((card) => ({
    card,
    position: Math.random() > 0.5 ? 'upright' : 'reversed'
  }))
}

function getCardScore(drawn_card: DrawnResult): number {
  const sentiment = drawn_card.position === 'upright'
    ? drawn_card.card.upright.sentiment
    : drawn_card.card.reversed.sentiment

  switch (sentiment) {
    case 'positive':
      return 1
    case 'negative':
      return -1
    default:
      return 0
  }
}

export function generateReading(drawn_cards: DrawnResult[]): ReadingResult {
  const total_score = drawn_cards
    .map(getCardScore)
    .reduce((sum, score) => sum + score, 0)

  let result: ReadingResult['result']

  if (total_score > 0) {
    result = 'yes'
  } else if (total_score < 0) {
    result = 'no'
  } else {
    result = 'uncertain'
  }

  return {
    result,
    cardDetails: drawn_cards.map((drawn_card) => ({
      card: drawn_card.card,
      position: drawn_card.position,
      meaning: drawn_card.position === 'upright'
        ? drawn_card.card.upright.meaning
        : drawn_card.card.reversed.meaning
    }))
  }
}

