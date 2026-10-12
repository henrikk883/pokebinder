import type { CardLang } from '../../types/binder'
import type { Deck, DeckCard, DeckFormat } from '../../types/deck'
import { defaultContext, type ModelContext } from '../binder/binderModel'

/** A deck is played with exactly this many cards. */
export const DECK_SIZE = 60
/** Of cards with the same name a deck may hold this many; basic energy is exempt. */
export const MAX_SAME_NAME = 4

export const DECK_CATEGORIES = ['pokemon', 'trainer', 'energy', 'unknown'] as const
/** What kind of card it is; `unknown` while that is being looked up or cannot be told. */
export type DeckCategory = (typeof DECK_CATEGORIES)[number]

/** What the rules of a deck need to know about a card. */
export interface DeckCardInfo {
  name: string
  category: DeckCategory
  /** Basic energy may be in a deck as often as one likes. */
  basicEnergy: boolean
  /** Whether the card may be played in the tournament formats; missing where that is not known. */
  legal?: { standard: boolean; expanded: boolean }
  /** Cardmarket price trend of the card in its usual finish, in euros; missing where there is none. */
  price?: number
}

/** Looks a card of the deck up; `undefined` while nothing is known about it. */
export type InfoOf = (card: DeckCard) => DeckCardInfo | undefined

export function createDeck(name: string, ctx: ModelContext = defaultContext): Deck {
  const timestamp = ctx.now()
  return {
    id: ctx.newId(),
    name: name.trim(),
    format: 'standard',
    cards: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const same = (card: DeckCard, cardId: string, lang: CardLang) => card.cardId === cardId && card.lang === lang

/** How often a card is in the deck. */
export function countInDeck(deck: Deck, cardId: string, lang: CardLang): number {
  return deck.cards.find((card) => same(card, cardId, lang))?.count ?? 0
}

/**
 * Sets how often a card is in the deck: 0 takes it out, a card not yet in it is added at
 * the end. The rules are not enforced here; `checkDeck` says what is wrong with a deck.
 */
export function setCardCount(
  deck: Deck,
  cardId: string,
  lang: CardLang,
  count: number,
  ctx: ModelContext = defaultContext,
): Deck {
  const wanted = Math.max(0, Math.min(DECK_SIZE, Math.floor(count)))
  if (wanted === countInDeck(deck, cardId, lang)) return deck
  const known = deck.cards.some((card) => same(card, cardId, lang))
  const cards = known
    ? deck.cards.flatMap((card) => (same(card, cardId, lang) ? (wanted > 0 ? [{ ...card, count: wanted }] : []) : [card]))
    : [...deck.cards, { cardId, lang, count: wanted }]
  return { ...deck, cards, updatedAt: ctx.now() }
}

/** Adds copies of a card (or, with a negative number, takes some out). */
export function addCard(deck: Deck, cardId: string, lang: CardLang, copies = 1, ctx: ModelContext = defaultContext): Deck {
  return setCardCount(deck, cardId, lang, countInDeck(deck, cardId, lang) + copies, ctx)
}

export function renameDeck(deck: Deck, name: string, ctx: ModelContext = defaultContext): Deck {
  const trimmed = name.trim()
  if (!trimmed || trimmed === deck.name) return deck
  return { ...deck, name: trimmed, updatedAt: ctx.now() }
}

/** Says which cards the deck may hold from now on; the cards in it stay as they are. */
export function setFormat(deck: Deck, format: DeckFormat, ctx: ModelContext = defaultContext): Deck {
  return format === deck.format ? deck : { ...deck, format, updatedAt: ctx.now() }
}

/**
 * Whether a card may be played in a format. `undefined` where that is not known – a card
 * is only objected to when it is known not to be allowed.
 */
export function isAllowed(info: DeckCardInfo | undefined, format: DeckFormat): boolean | undefined {
  if (format === 'free') return true
  return info?.legal?.[format]
}

/** Puts a picture on the deck box, or takes it off (`undefined`). */
export function setDeckCover(deck: Deck, assetId: string | undefined, ctx: ModelContext = defaultContext): Deck {
  if (assetId === deck.coverAssetId) return deck
  const next: Deck = { ...deck, updatedAt: ctx.now() }
  if (assetId === undefined) delete next.coverAssetId
  else next.coverAssetId = assetId
  return next
}

/** How many cards the deck holds, copies counted. */
export function deckSize(deck: Deck): number {
  return deck.cards.reduce((sum, card) => sum + card.count, 0)
}

export interface DeckGroup {
  category: DeckCategory
  cards: DeckCard[]
  /** Copies counted. */
  count: number
}

/** The cards by kind – Pokémon, trainers, energy, then what is not known yet; empty kinds are left out. */
export function groupDeck(deck: Deck, infoOf: InfoOf): DeckGroup[] {
  return DECK_CATEGORIES.map((category) => {
    const cards = deck.cards.filter((card) => (infoOf(card)?.category ?? 'unknown') === category)
    return { category, cards, count: cards.reduce((sum, card) => sum + card.count, 0) }
  }).filter((group) => group.cards.length > 0)
}

export interface DeckCheck {
  size: number
  /** Cards short of a full deck; negative when there are too many. */
  missing: number
  /** Names the deck holds more often than allowed, with how often. */
  tooMany: { name: string; count: number }[]
  /** Names of cards that may not be played in the format of the deck, with how many copies. */
  notAllowed: { name: string; count: number }[]
  /** Nothing to object to: the right size, no name too often, every card allowed. */
  valid: boolean
}

/**
 * What the basic rules say about the deck. Cards count by name, across sets and languages
 * of the same name; a card nothing is known about yet counts for itself.
 */
export function checkDeck(deck: Deck, infoOf: InfoOf): DeckCheck {
  const byName = new Map<string, { name: string; count: number }>()
  const notAllowed: { name: string; count: number }[] = []
  for (const card of deck.cards) {
    const info = infoOf(card)
    if (isAllowed(info, deck.format) === false) {
      const name = info?.name ?? card.cardId
      const listed = notAllowed.find((entry) => entry.name === name)
      if (listed) listed.count += card.count
      else notAllowed.push({ name, count: card.count })
    }
    if (info?.basicEnergy) continue
    const key = info ? `name:${info.name}` : `card:${card.lang}:${card.cardId}`
    const entry = byName.get(key) ?? { name: info?.name ?? card.cardId, count: 0 }
    entry.count += card.count
    byName.set(key, entry)
  }
  const size = deckSize(deck)
  const tooMany = [...byName.values()].filter((entry) => entry.count > MAX_SAME_NAME)
  return {
    size,
    missing: DECK_SIZE - size,
    tooMany,
    notAllowed,
    valid: size === DECK_SIZE && tooMany.length === 0 && notAllowed.length === 0,
  }
}
