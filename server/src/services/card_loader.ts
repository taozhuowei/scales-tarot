/**
 * Card Loader Service
 * Loads all 78 tarot cards from local JSON data files.
 * Constructs image URLs using STATIC_BASE_URL (default: http://localhost:3000).
 * Caches the result as a singleton — loaded once at server start.
 */

import cupsData from '../data/tarot-cups.json'
import majorData from '../data/tarot-major.json'
import pentaclesData from '../data/tarot-pentacles.json'
import swordsData from '../data/tarot-swords.json'
import wandsData from '../data/tarot-wands.json'

import { getDefaultTheme } from './theme_loader'

// Derive tarot image base from default theme; fallback to hardcoded path
function getThemeTarotBase(): string {
  const theme = getDefaultTheme()
  if (theme) {
    // card_back is like http://host/static/themes/golden_dawn/tarot/card_back.jpeg
    return theme.images.card_back.replace(/\/[^/]+$/, '')
  }
  const base = process.env.STATIC_BASE_URL ?? 'http://localhost:3000'
  return `${base}/static/themes/golden_dawn/tarot`
}

export interface TarotCardMeaning {
  keywords: string[]
  meaning: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface TarotCard {
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

// JSON files omit the image field — we build it at load time
type CardSeed = Omit<TarotCard, 'image'> & { image?: string }

function buildImageUrl(card: CardSeed): string {
  if (card.type === 'major') {
    const num = String(card.number).padStart(2, '0')
    return `${getThemeTarotBase()}/major/major_arcana_${num}_${card.id}.jpeg`
  }
  const suit = card.suit ?? ''
  const num = String(card.number).padStart(2, '0')
  const name = card.nameEn.toLowerCase().replace(/\s+/g, '_')
  return `${getThemeTarotBase()}/minor/${suit}/minor_arcana_${suit}_${num}_${name}.jpeg`
}

function normalize(seed: CardSeed): TarotCard {
  return { ...seed, image: buildImageUrl(seed) }
}

let _cards: TarotCard[] | null = null

export function getAllCards(): TarotCard[] {
  if (_cards) return _cards
  const seeds: CardSeed[] = [
    ...(majorData.majorArcana as CardSeed[]),
    ...(wandsData.wands.cards as CardSeed[]),
    ...(cupsData.cups.cards as CardSeed[]),
    ...(swordsData.swords.cards as CardSeed[]),
    ...(pentaclesData.pentacles.cards as CardSeed[])
  ]
  _cards = seeds.map(normalize)
  return _cards
}

export function getCardById(id: string): TarotCard | undefined {
  return getAllCards().find(c => c.id === id)
}
