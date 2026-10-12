import type { CardLang } from './binder'

export const DECK_FORMATS = ['standard', 'expanded', 'free'] as const
/** Which cards a deck may hold: the current sets, more of them, or anything. */
export type DeckFormat = (typeof DECK_FORMATS)[number]

/** A card of a deck with how often it is in it. Finishes play no part in a game. */
export interface DeckCard {
  cardId: string
  lang: CardLang
  count: number
}

/** A deck to play with: a list of cards, not pages of pockets. Like a binder it holds references only. */
export interface Deck {
  id: string
  name: string
  format: DeckFormat
  /** In the order the cards were first added. */
  cards: DeckCard[]
  /** Picture on the front of the deck box, from the image library. */
  coverAssetId?: string
  createdAt: string
  updatedAt: string
}
