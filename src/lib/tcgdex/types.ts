import type { CardLang, CardVariant } from '../../types/binder'
import type { PlayInfo } from './play'
import type { Price } from './prices'

export type { CardCategory, PlayInfo } from './play'
export type { Price } from './prices'

/** A card as it appears in lists: enough to show a tile, nothing more. */
export interface CardSummary {
  id: string
  localId: string
  name: string
  /** Base image URL without quality and extension; missing for cards TCGdex has no scan of. */
  image?: string
}

/** A card with what a master set and the list of missing cards need to know about it. */
export interface CardDetail extends CardSummary {
  /** Rarity in the card language, e.g. "Selten, Illustration". */
  rarity?: string
  /**
   * National Pokédex number of the Pokémon on the card; the lowest one for cards that
   * show several. Missing for trainer and energy cards.
   */
  dexNumber?: number
  /** Finishes that belong into a binder, base finish first; never empty. */
  variants: CardVariant[]
}

export interface SetSummary {
  id: string
  name: string
  seriesId: string
  /** Base logo URL without extension; falls back to the English logo. */
  logo?: string
  cardCount: {
    total: number
    official: number
  }
}

export interface SeriesWithSets {
  id: string
  name: string
  sets: SetSummary[]
}

export interface Catalog {
  /** Newest series first; series without physical cards are left out. */
  series: SeriesWithSets[]
  setsById: ReadonlyMap<string, SetSummary>
}

export interface CardQuery {
  name?: string
  /** Card number within its set, e.g. `25` or `025`. */
  number?: string
  /** Second half of a printed number like `188/125`: only sets with that official size. */
  officialCount?: number
  setId?: string
  rarity?: string
  type?: string
  /**
   * National Pokédex number: every card of that Pokémon, whatever it is called in the
   * language asked in. Stands in for the name where the name was typed in another language.
   */
  dexId?: number
}

export interface CardPage {
  cards: CardSummary[]
  hasMore: boolean
}

export interface TcgdexClient {
  readonly lang: CardLang
  getCatalog(): Promise<Catalog>
  /** All cards of a set in number order. */
  getSetCards(setId: string): Promise<CardSummary[]>
  /** A single card by id, as stored in a binder; `undefined` when TCGdex does not know it. */
  getCard(cardId: string): Promise<CardSummary | undefined>
  /** All cards of a set in number order, with rarity and finishes. */
  getSetDetails(setId: string): Promise<CardDetail[]>
  /** Rarity and finishes of one card; `undefined` when TCGdex does not know it. */
  getCardDetail(cardId: string): Promise<CardDetail | undefined>
  /**
   * Cardmarket price of a card in one finish; `undefined` when there is none. Needs a
   * request per card, so ask only for the cards that are really wanted.
   */
  getPrice(cardId: string, variant: CardVariant): Promise<Price | undefined>
  /**
   * Kind of a card and where it may be played, for decks; `undefined` when TCGdex does not
   * know the card. A request per card, like the price.
   */
  getPlayInfo(cardId: string): Promise<PlayInfo | undefined>
  /**
   * Pokédex numbers of the Pokémon whose name in this client's language contains `name`,
   * the most frequent first; empty for trainers, energy and names nothing matches. This is
   * how a name typed in one language leads to the cards in another.
   */
  dexIdsOfName(name: string): Promise<number[]>
  /** One page of cards matching the query; pages start at 1. */
  queryCards(query: CardQuery, page: number): Promise<CardPage>
  getRarities(): Promise<string[]>
  getTypes(): Promise<string[]>
}
