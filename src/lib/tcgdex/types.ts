import type { CardLang } from '../../types/binder'

/** A card as it appears in lists: enough to show a tile, nothing more. */
export interface CardSummary {
  id: string
  localId: string
  name: string
  /** Base image URL without quality and extension; missing for cards TCGdex has no scan of. */
  image?: string
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
  /** One page of cards matching the query; pages start at 1. */
  queryCards(query: CardQuery, page: number): Promise<CardPage>
  getRarities(): Promise<string[]>
  getTypes(): Promise<string[]>
}
