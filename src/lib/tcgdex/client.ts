import TCGdex, { Query } from '@tcgdex/sdk'
import type { CardLang } from '../../types/binder'
import type { ResponseCache } from './cache'
import { matchesNumber, setIdOfCard, setIdOfCardId, sortByNumber } from './cardIds'
import type {
  CardPage,
  CardQuery,
  CardSummary,
  Catalog,
  SeriesWithSets,
  SetSummary,
  TcgdexClient,
} from './types'

export const CARDS_PER_PAGE = 60
const MAX_CARDS_PER_REQUEST = 1000

function lastSegment(value: string): string {
  return value.slice(value.lastIndexOf(',') + 1).trim()
}

/** Series that only exist in the mobile game "Pokémon TCG Pocket"; there is nothing to put in a binder. */
const DIGITAL_ONLY_SERIES = new Set(['tcgp'])

/** Rarities used by Pocket cards only (TCGdex lists them untranslated). */
const DIGITAL_ONLY_RARITIES = new Set(
  [
    'Couronne',
    'Deux Chromatique',
    'Un Chromatique',
    'Une Diamant',
    'deux Diamant',
    'Trois Diamant',
    'Quatre Diamant',
    'Une Étoile',
    'deux Étoiles',
    'Trois Étoiles',
  ].map((rarity) => rarity.toLowerCase()),
)

export type QueryParam = { key: string; value: string | number | boolean }
export type Endpoint = 'cards' | 'sets' | 'series' | 'rarities' | 'types'

/** Fetches one TCGdex resource; resolves to `undefined` when it does not exist. */
export type Transport = (
  lang: CardLang,
  path: [Endpoint, ...string[]],
  params: QueryParam[],
) => Promise<unknown>

interface RawCard {
  id: string
  localId: string
  name: string
  image?: string
}

interface RawSet {
  id: string
  name: string
  logo?: string
  cardCount: { total: number; official: number }
}

interface RawSeries {
  id: string
  name: string
  sets?: RawSet[]
}

/** The SDK's own cache is switched off: responses are cached in IndexedDB instead. */
const noCache = {
  get: () => undefined,
  set: () => true,
  delete: () => true,
  clear: () => true,
  has: () => false,
  getMultiple: () => ({}),
  setMultiple: () => true,
  deleteMultiple: () => true,
}

export function createSdkTransport(): Transport {
  const sdks = new Map<CardLang, TCGdex>()
  return (lang, path, params) => {
    let sdk = sdks.get(lang)
    if (!sdk) {
      sdk = new TCGdex(lang)
      sdk.setCache(noCache)
      sdks.set(lang, sdk)
    }
    return sdk.fetchWithQuery<unknown>(path, params)
  }
}

function toCard(raw: RawCard): CardSummary {
  const card: CardSummary = { id: raw.id, localId: raw.localId, name: raw.name }
  if (raw.image) card.image = raw.image
  return card
}

export interface TcgdexClientOptions {
  lang: CardLang
  transport: Transport
  cache: ResponseCache
}

export function createTcgdexClient({ lang, transport, cache }: TcgdexClientOptions): TcgdexClient {
  function request<T>(
    requestLang: CardLang,
    path: [Endpoint, ...string[]],
    params: QueryParam[] = [],
  ): Promise<T | undefined> {
    const query = params.map(({ key, value }) => `${key}=${value}`).join('&')
    const key = `${requestLang}/${path.join('/')}${query ? `?${query}` : ''}`
    return cache.fetch(key, async () => {
      const value = await transport(requestLang, path, params)
      // "not found" must not be cached as a result
      if (value === undefined) throw new Error(`TCGdex has no ${key}`)
      return value as T
    })
  }

  async function requestList<T>(
    requestLang: CardLang,
    path: [Endpoint, ...string[]],
    params: QueryParam[] = [],
  ): Promise<T[]> {
    const value = await request<T[]>(requestLang, path, params)
    return Array.isArray(value) ? value : []
  }

  /** English logos by set id, for the many sets without a logo in the card language. */
  async function fallbackLogos(): Promise<Map<string, string>> {
    if (lang === 'en') return new Map()
    try {
      const sets = await requestList<RawSet>('en', ['sets'])
      return new Map(sets.flatMap((set) => (set.logo ? [[set.id, set.logo] as const] : [])))
    } catch {
      return new Map()
    }
  }

  /** Ids of all cards with exactly this rarity. */
  async function cardIdsOfRarity(rarity: string): Promise<Set<string>> {
    const detail = await request<{ cards?: RawCard[] }>(lang, ['rarities', rarity])
    return new Set((detail?.cards ?? []).map((card) => card.id))
  }

  let catalog: Promise<Catalog> | undefined

  async function loadCatalog(): Promise<Catalog> {
    const allSeries = await requestList<RawSeries>(lang, ['series'])
    const physical = allSeries.filter((series) => !DIGITAL_ONLY_SERIES.has(series.id))
    const [details, logos] = await Promise.all([
      Promise.all(physical.map((series) => request<RawSeries>(lang, ['series', series.id]))),
      fallbackLogos(),
    ])

    const series: SeriesWithSets[] = []
    const setsById = new Map<string, SetSummary>()
    for (const detail of details) {
      if (!detail) continue
      const sets = (detail.sets ?? []).map((raw): SetSummary => {
        const set: SetSummary = {
          id: raw.id,
          name: raw.name,
          seriesId: detail.id,
          cardCount: { total: raw.cardCount.total, official: raw.cardCount.official },
        }
        const logo = raw.logo ?? logos.get(raw.id)
        if (logo) set.logo = logo
        setsById.set(set.id, set)
        return set
      })
      series.push({ id: detail.id, name: detail.name, sets })
    }
    return { series: series.reverse(), setsById }
  }

  function getCatalog(): Promise<Catalog> {
    catalog ??= loadCatalog().catch((error: unknown) => {
      catalog = undefined
      throw error
    })
    return catalog
  }

  // A binder page asks for many cards of the same set at once; they share one lookup.
  const setCards = new Map<string, Promise<CardSummary[]>>()

  function getSetCards(setId: string): Promise<CardSummary[]> {
    let cards = setCards.get(setId)
    if (!cards) {
      cards = request<{ cards?: RawCard[] }>(lang, ['sets', setId])
        .then((set) => sortByNumber((set?.cards ?? []).map(toCard)))
        .catch((error: unknown) => {
          setCards.delete(setId)
          throw error
        })
      setCards.set(setId, cards)
    }
    return cards
  }

  const client: TcgdexClient = {
    lang,
    getCatalog,
    getSetCards,

    async getCard(cardId) {
      const { setsById } = await getCatalog()
      const setId = setIdOfCardId(cardId, setsById)
      if (setId !== undefined) {
        const card = (await getSetCards(setId)).find((entry) => entry.id === cardId)
        if (card) return card
      }
      // not part of a listed set: ask for the card itself
      const raw = await request<RawCard>(lang, ['cards', cardId]).catch(() => undefined)
      return raw ? toCard(raw) : undefined
    },

    async queryCards(query: CardQuery, page: number): Promise<CardPage> {
      const { number, rarity, officialCount, ...rest } = query

      // "188/125" without a chosen set: look in every set that has 125 official cards
      if (officialCount !== undefined && query.setId === undefined) {
        const { series } = await getCatalog()
        const candidates = series
          .flatMap((entry) => entry.sets)
          .filter((set) => set.cardCount.official === officialCount)
        const pages = await Promise.all(
          candidates.map((set) => client.queryCards({ ...rest, number, rarity, setId: set.id }, 1)),
        )
        return { cards: pages.flatMap((result) => result.cards), hasMore: false }
      }

      // Narrow queries are fetched in one go, because the exact filters below run on our side.
      const complete = query.setId !== undefined || number !== undefined
      const pageSize = complete ? MAX_CARDS_PER_REQUEST : CARDS_PER_PAGE

      const builder = Query.create()
      if (query.name) builder.like('name', query.name)
      // TCGdex matches numbers loosely ("25" also finds 125)
      if (number) builder.like('localId', number.replace(/^0+(?=.)/, ''))
      if (query.setId) builder.equal('set.id', query.setId)
      if (rarity) {
        // A comma separates alternatives in TCGdex queries, so such names cannot be matched exactly.
        if (rarity.includes(',')) builder.like('rarity', lastSegment(rarity))
        else builder.equal('rarity', rarity)
      }
      if (query.type) builder.like('types', query.type)
      builder.paginate(complete ? 1 : page, pageSize)

      const [raw, { setsById }, rarityIds] = await Promise.all([
        requestList<RawCard>(lang, ['cards'], builder.params),
        getCatalog(),
        rarity?.includes(',') ? cardIdsOfRarity(rarity) : undefined,
      ])
      const cards = raw
        .map(toCard)
        .filter((card) => setsById.has(setIdOfCard(card)))
        .filter((card) => number === undefined || matchesNumber(card.localId, number))
        .filter((card) => rarityIds === undefined || rarityIds.has(card.id))
      return {
        // across sets there is no natural order, so cards one can actually look at come first
        cards: query.setId
          ? sortByNumber(cards)
          : [...cards.filter((card) => card.image), ...cards.filter((card) => !card.image)],
        hasMore: !complete && raw.length === pageSize,
      }
    },

    async getRarities() {
      const rarities = await requestList<string>(lang, ['rarities'])
      return rarities
        .filter((rarity) => !DIGITAL_ONLY_RARITIES.has(rarity.toLowerCase()))
        .sort((a, b) => a.localeCompare(b, lang))
    },

    async getTypes() {
      const types = await requestList<string>(lang, ['types'])
      return [...types].sort((a, b) => a.localeCompare(b, lang))
    },
  }
  return client
}
