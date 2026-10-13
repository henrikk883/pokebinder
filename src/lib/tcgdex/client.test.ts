import { describe, expect, it } from 'vitest'
import type { ResponseCache } from './cache'
import {
  CARDS_PER_PAGE,
  createTcgdexClient,
  dexIdsOf,
  dexIdsQuery,
  MAX_FOREIGN_POKEMON,
  setDetailsQuery,
  type QueryParam,
} from './client'

const passThrough: ResponseCache = { fetch: (_key, load) => load() }

const card = (id: string, localId: string, name: string, withImage = true) => ({
  id,
  localId,
  name,
  ...(withImage ? { image: `https://assets.tcgdex.net/de/x/${id}` } : {}),
})

/** A miniature TCGdex: two card series plus the digital-only Pocket series. */
const responses: Record<string, unknown> = {
  'de/series': [
    { id: 'swsh', name: 'Schwert & Schild' },
    { id: 'sv', name: 'Karmesin & Purpur' },
    { id: 'tcgp', name: 'Pokémon-Sammelkartenspiel-Pocket' },
  ],
  'de/series/swsh': {
    id: 'swsh',
    name: 'Schwert & Schild',
    sets: [{ id: 'swsh3', name: 'Flammende Finsternis', cardCount: { total: 201, official: 189 } }],
  },
  'de/series/sv': {
    id: 'sv',
    name: 'Karmesin & Purpur',
    sets: [
      { id: 'svp', name: 'SVP Black Star Promos', cardCount: { total: 225, official: 225 } },
      {
        id: 'sv03.5',
        name: '151',
        logo: 'https://assets.tcgdex.net/de/sv/sv03.5/logo',
        cardCount: { total: 207, official: 165 },
      },
    ],
  },
  'de/series/tcgp': {
    id: 'tcgp',
    name: 'Pokémon-Sammelkartenspiel-Pocket',
    sets: [{ id: 'A1', name: 'Unschlagbare Gene', cardCount: { total: 286, official: 226 } }],
  },
  'en/sets': [
    { id: 'swsh3', name: 'Darkness Ablaze', logo: 'https://assets.tcgdex.net/en/swsh/swsh3/logo' },
    { id: 'sv03.5', name: '151', logo: 'https://assets.tcgdex.net/en/sv/sv03.5/logo' },
    { id: 'svp', name: 'SVP Black Star Promos' },
  ],
  'de/sets/sv03.5': {
    id: 'sv03.5',
    cards: [
      card('sv03.5-010', '010', 'Raupy'),
      card('sv03.5-002', '002', 'Bisaknosp'),
      card('sv03.5-166', '166', 'Bisasam', false),
      card('sv03.5-001', '001', 'Bisasam'),
    ],
  },
  'de/rarities': ['Selten', 'Häufig', 'Une Diamant', 'Couronne', 'Selten, Illustration', 'deux Étoiles'],
  'de/types': ['Wasser', 'Feuer', 'Elektro'],
  'de/rarities/Selten, Illustration': {
    name: 'Selten, Illustration',
    cards: [card('sv03.5-166', '166', 'Bisasam'), card('sv03.5-170', '170', 'Pikachu')],
  },
}

/** What TCGdex answers to the set details query for "151" (shortened). */
const setDetailsResponse = {
  cards: [
    { ...card('sv03.5-025', '025', 'Pikachu'), rarity: 'Häufig', dexId: [25] },
    { ...card('sv03.5-006', '006', 'Glurak-ex'), rarity: 'Doppelselten', dexId: [6] },
    // a card showing two Pokémon is filed under the first of them
    { ...card('sv03.5-173', '173', 'Pikachu'), rarity: 'Selten, Illustration', dexId: [133, 25] },
    { ...card('sv03.5-207', '207', 'Mew-ex', false), rarity: null },
    // the id filter of TCGdex matches loosely and may return cards of other sets
    { ...card('xsv03.5-001', '001', 'Fremd'), rarity: 'Häufig' },
  ],
  prints: [
    {
      id: 'sv03.5-025',
      variants_detailed: [
        { type: 'normal', foil: null, stamp: null, size: 'standard' },
        { type: 'reverse', foil: null, stamp: null, size: 'standard' },
        { type: 'reverse', foil: 'pokeball', stamp: null, size: 'standard' },
        { type: 'normal', foil: null, stamp: ['snowflake'], size: 'standard' },
        { type: 'reverse', foil: 'cosmos', stamp: null, size: 'standard' },
      ],
    },
    { id: 'sv03.5-006', variants_detailed: [{ type: 'holo', foil: null, stamp: null, size: 'standard' }] },
    { id: 'sv03.5-207', variants_detailed: [{ type: 'holo', foil: 'gold', stamp: null, size: 'standard' }] },
  ],
}

const noGraphql = () => Promise.reject(new Error('GraphQL is not part of this test'))

function setup(cards: unknown[] = []) {
  const calls: { key: string; params: QueryParam[] }[] = []
  const queries: string[] = []
  const client = createTcgdexClient({
    lang: 'de',
    cache: passThrough,
    graphql: async (query) => {
      queries.push(query)
      if (query.includes('"sv03.5-"')) return setDetailsResponse
      throw new Error('unknown set')
    },
    transport: async (lang, path, params) => {
      const key = `${lang}/${path.join('/')}`
      calls.push({ key, params })
      return key === 'de/cards' ? cards : responses[key]
    },
  })
  const cardParams = () => {
    const call = calls.find((c) => c.key === 'de/cards')
    return Object.fromEntries((call?.params ?? []).map(({ key, value }) => [key, value]))
  }
  return { client, calls, queries, cardParams }
}

describe('which Pokémon a name stands for', () => {
  it('asks for the Pokédex numbers of the cards carrying the name, in the client\'s language', async () => {
    const queries: string[] = []
    const client = createTcgdexClient({
      lang: 'en',
      cache: passThrough,
      transport: async () => [],
      graphql: async (query) => {
        queries.push(query)
        return { cards: [{ dexId: [54] }, { dexId: [54] }, { dexId: [55] }, { dexId: null }, { dexId: [54, 25] }] }
      },
    })

    expect(await client.dexIdsOfName('  Psyduck ')).toEqual([54, 55])
    expect(queries).toEqual([dexIdsQuery('Psyduck', 'en')])
    expect(queries[0]).toContain('@locale(lang: "en")')
    // nothing to ask for nothing
    expect(await client.dexIdsOfName('  ')).toEqual([])
    expect(queries).toHaveLength(1)
  })

  it('cannot be broken out of by what is typed', () => {
    expect(dexIdsQuery('a" }) { id } #', 'en')).toContain('name: "a\\" }) { id } #"')
  })

  it('puts the most frequent Pokémon first and stops at a handful', () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({ dexId: [i % 10] }))

    expect(dexIdsOf({ cards: [...cards, { dexId: [7] }] })).toEqual([7, 0, 1, 2, 3, 4].slice(0, MAX_FOREIGN_POKEMON))
    // only the cards called exactly so: a name that is merely part of another is no Pokémon's name
    const named = { cards: [{ name: 'Enton', dexId: [54] }, { name: 'enton ', dexId: [54] }, { name: 'Mistys Enton', dexId: [54] }, { name: 'Entoron', dexId: [55] }] }
    expect(dexIdsOf(named)).toEqual([54, 55])
    expect(dexIdsOf(named, 'ENTON')).toEqual([54])
    expect(dexIdsOf(named, 'Ento')).toEqual([])
    expect(dexIdsOf({ cards: [{ dexId: [54] }] }, 'Enton')).toEqual([])
    expect(dexIdsOf({ cards: null })).toEqual([])
    expect(dexIdsOf(undefined)).toEqual([])
  })

  it('finds the cards of a Pokémon by its number', async () => {
    const { client, cardParams } = setup([])

    await client.queryCards({ dexId: 54 }, 1)

    expect(cardParams()).toMatchObject({ dexId: 'eq:54' })
  })
})

describe('getCatalog', () => {
  it('lists series newest first with their sets, without the Pocket series', async () => {
    const { client } = setup()

    const catalog = await client.getCatalog()

    expect(catalog.series.map((series) => series.name)).toEqual([
      'Karmesin & Purpur',
      'Schwert & Schild',
    ])
    expect(catalog.series[0]?.sets.map((set) => set.id)).toEqual(['svp', 'sv03.5'])
    expect([...catalog.setsById.keys()].sort()).toEqual(['sv03.5', 'svp', 'swsh3'])
  })

  it('keeps card counts and prefers the German logo over the English one', async () => {
    const { client } = setup()

    const { setsById } = await client.getCatalog()

    expect(setsById.get('sv03.5')).toEqual({
      id: 'sv03.5',
      name: '151',
      seriesId: 'sv',
      logo: 'https://assets.tcgdex.net/de/sv/sv03.5/logo',
      cardCount: { total: 207, official: 165 },
    })
    expect(setsById.get('swsh3')?.logo).toBe('https://assets.tcgdex.net/en/swsh/swsh3/logo')
    expect(setsById.get('svp')).not.toHaveProperty('logo')
  })

  it('asks TCGdex only once', async () => {
    const { client, calls } = setup()

    await client.getCatalog()
    const before = calls.length
    await client.getCatalog()

    expect(calls).toHaveLength(before)
  })

  it('can be retried after a failure', async () => {
    let online = false
    const client = createTcgdexClient({
      lang: 'de',
      cache: passThrough,
      graphql: noGraphql,
      transport: async (lang, path) => {
        if (!online) throw new Error('offline')
        return responses[`${lang}/${path.join('/')}`]
      },
    })

    await expect(client.getCatalog()).rejects.toThrow('offline')
    online = true

    expect((await client.getCatalog()).series).toHaveLength(2)
  })
})

describe('getSetCards', () => {
  it('returns all cards of a set in number order, with and without image', async () => {
    const { client } = setup()

    const cards = await client.getSetCards('sv03.5')

    expect(cards.map((c) => c.localId)).toEqual(['001', '002', '010', '166'])
    expect(cards[0]).toEqual({
      id: 'sv03.5-001',
      localId: '001',
      name: 'Bisasam',
      image: 'https://assets.tcgdex.net/de/x/sv03.5-001',
    })
    expect(cards[3]).toEqual({ id: 'sv03.5-166', localId: '166', name: 'Bisasam' })
  })

  it('fails for a set TCGdex does not know', async () => {
    const { client } = setup()

    await expect(client.getSetCards('nope')).rejects.toThrow()
  })
})

describe('getCard', () => {
  it('finds a binder card through the card list of its set', async () => {
    const { client, calls } = setup()

    expect(await client.getCard('sv03.5-002')).toEqual({
      id: 'sv03.5-002',
      localId: '002',
      name: 'Bisaknosp',
      image: 'https://assets.tcgdex.net/de/x/sv03.5-002',
    })
    expect(calls.map((call) => call.key)).toContain('de/sets/sv03.5')
    expect(calls.map((call) => call.key)).not.toContain('de/cards/sv03.5-002')
  })

  it('loads the set only once for all cards of a page', async () => {
    const { client, calls } = setup()

    await Promise.all(['sv03.5-001', 'sv03.5-002', 'sv03.5-010'].map((id) => client.getCard(id)))

    expect(calls.filter((call) => call.key === 'de/sets/sv03.5')).toHaveLength(1)
  })

  it('returns nothing for a card TCGdex does not know', async () => {
    const { client } = setup()

    expect(await client.getCard('sv03.5-999')).toBeUndefined()
    expect(await client.getCard('mystery-1')).toBeUndefined()
  })
})

describe('getSetDetails', () => {
  it('returns the cards of a set in number order with rarity and finishes', async () => {
    const { client } = setup()

    const details = await client.getSetDetails('sv03.5')

    expect(details.map((detail) => detail.id)).toEqual([
      'sv03.5-006',
      'sv03.5-025',
      'sv03.5-173',
      'sv03.5-207',
    ])
    expect(details[1]).toEqual({
      id: 'sv03.5-025',
      localId: '025',
      name: 'Pikachu',
      image: 'https://assets.tcgdex.net/de/x/sv03.5-025',
      rarity: 'Häufig',
      dexNumber: 25,
      // stamped prints and the cosmos foil from special products are not part of the set
      variants: ['normal', 'reverse', 'pokeball'],
    })
    expect(details[0]).toMatchObject({ rarity: 'Doppelselten', variants: ['holo'], dexNumber: 6 })
  })

  it('reads the Pokédex number: the lowest for several Pokémon, none for trainers', async () => {
    const { client } = setup()

    const details = await client.getSetDetails('sv03.5')

    expect(details[2]).toMatchObject({ id: 'sv03.5-173', dexNumber: 25 })
    expect(details[3]).not.toHaveProperty('dexNumber')
  })

  it('gives every card a finish, even without print data, and tolerates a missing rarity', async () => {
    const { client } = setup()

    const details = await client.getSetDetails('sv03.5')

    expect(details[2]).toMatchObject({ id: 'sv03.5-173', variants: ['normal'] })
    expect(details[3]).toEqual({ id: 'sv03.5-207', localId: '207', name: 'Mew-ex', variants: ['holo'] })
  })

  it('asks for names in German and for finishes in English, in one request', async () => {
    const { client, queries } = setup()

    await client.getSetDetails('sv03.5')
    await client.getSetDetails('sv03.5')

    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('@locale(lang: "de") { id localId name image rarity dexId illustrator }')
    expect(queries[0]).toContain('@locale(lang: "en") { id variants_detailed')
  })

  it('reads the finishes of Japanese sets from the Japanese data', () => {
    // western sets share their ids with the English data, Japanese sets do not exist there
    expect(setDetailsQuery('sv03.5', 'en')).toContain('@locale(lang: "en") { id variants_detailed')
    expect(setDetailsQuery('SV2a', 'ja')).toContain('@locale(lang: "ja") { id localId name image rarity dexId illustrator }')
    expect(setDetailsQuery('SV2a', 'ja')).toContain('@locale(lang: "ja") { id variants_detailed')
    expect(setDetailsQuery('SV2a', 'ja')).toContain('id: "SV2a-"')
  })

  it('finds the details of a single binder card', async () => {
    const { client } = setup()

    expect(await client.getCardDetail('sv03.5-006')).toMatchObject({ name: 'Glurak-ex', rarity: 'Doppelselten' })
    expect(await client.getCardDetail('sv03.5-999')).toBeUndefined()
    expect(await client.getCardDetail('mystery-1')).toBeUndefined()
  })

  it('fails when the set cannot be loaded, and tries again next time', async () => {
    const { client, queries } = setup()

    await expect(client.getSetDetails('swsh3')).rejects.toThrow()
    await expect(client.getSetDetails('swsh3')).rejects.toThrow()

    expect(queries).toHaveLength(2)
  })
})

describe('queryCards', () => {
  it('searches by name page by page', async () => {
    const page = Array.from({ length: CARDS_PER_PAGE }, (_, i) =>
      card(`sv03.5-${i}`, String(i), 'Glurak'),
    )
    const { client, cardParams } = setup(page)

    const result = await client.queryCards({ name: 'Glurak' }, 2)

    expect(cardParams()).toEqual({
      name: 'Glurak',
      'pagination:page': 2,
      'pagination:itemsPerPage': CARDS_PER_PAGE,
    })
    expect(result.cards).toHaveLength(CARDS_PER_PAGE)
    expect(result.hasMore).toBe(true)
  })

  it('knows when the last page is reached', async () => {
    const { client } = setup([card('swsh3-25', '25', 'Glurak')])

    expect((await client.queryCards({ name: 'Glurak' }, 1)).hasMore).toBe(false)
  })

  it('leaves out cards from the Pocket app and other unknown sets', async () => {
    const { client } = setup([
      card('A1-035', '035', 'Glurak'),
      card('sv03.5-006', '006', 'Glurak-ex'),
      card('2024sv-1', '1', 'Glurak'),
    ])

    const { cards } = await client.queryCards({ name: 'Glurak' }, 1)

    expect(cards.map((c) => c.id)).toEqual(['sv03.5-006'])
  })

  it('shows cards with an image before those without', async () => {
    const { client } = setup([
      card('swsh3-1', '1', 'Glurak', false),
      card('sv03.5-006', '006', 'Glurak-ex'),
      card('swsh3-2', '2', 'Glurak', false),
      card('swsh3-25', '25', 'Glurak'),
    ])

    const { cards } = await client.queryCards({ name: 'Glurak' }, 1)

    expect(cards.map((c) => c.id)).toEqual(['sv03.5-006', 'swsh3-25', 'swsh3-1', 'swsh3-2'])
  })

  it('fetches a set-bound query completely and sorts it by number', async () => {
    const { client, cardParams } = setup([
      card('sv03.5-199', '199', 'Glurak-ex'),
      card('sv03.5-006', '006', 'Glurak-ex'),
      card('sv03.5-183', '183', 'Glurak-ex'),
    ])

    const result = await client.queryCards({ name: 'Glurak', setId: 'sv03.5', type: 'Feuer' }, 3)

    expect(cardParams()).toEqual({
      name: 'Glurak',
      'set.id': 'eq:sv03.5',
      types: 'Feuer',
      'pagination:page': 1,
      'pagination:itemsPerPage': 1000,
    })
    expect(result.cards.map((c) => c.localId)).toEqual(['006', '183', '199'])
    expect(result.hasMore).toBe(false)
  })

  it('matches the card number exactly although TCGdex matches loosely', async () => {
    const { client, cardParams } = setup([
      card('sv03.5-025', '025', 'Pikachu'),
      card('sv03.5-125', '125', 'Elektek'),
      card('swsh3-25', '25', 'Glurak'),
    ])

    const { cards, hasMore } = await client.queryCards({ name: 'a', number: '025' }, 1)

    expect(cardParams()).toMatchObject({ localId: '25', 'pagination:itemsPerPage': 1000 })
    expect(cards.map((c) => c.id)).toEqual(['sv03.5-025', 'swsh3-25'])
    expect(hasMore).toBe(false)
  })

  it('finds a printed number like 006/165 in every set of that size', async () => {
    const calls: Record<string, string | number | boolean>[] = []
    const client = createTcgdexClient({
      lang: 'de',
      cache: passThrough,
      graphql: noGraphql,
      transport: async (lang, path, params) => {
        const key = `${lang}/${path.join('/')}`
        if (key !== 'de/cards') return responses[key]
        const query = Object.fromEntries(params.map(({ key: k, value }) => [k, value]))
        calls.push(query)
        return query['set.id'] === 'eq:sv03.5'
          ? [card('sv03.5-006', '006', 'Glurak-ex'), card('sv03.5-016', '016', 'Taubsi')]
          : []
      },
    })

    const result = await client.queryCards({ number: '006', officialCount: 165 }, 1)

    // 151 is the only set in the miniature catalog with 165 official cards
    expect(calls).toEqual([
      { localId: '6', 'set.id': 'eq:sv03.5', 'pagination:page': 1, 'pagination:itemsPerPage': 1000 },
    ])
    expect(result).toEqual({
      cards: [expect.objectContaining({ id: 'sv03.5-006' })],
      hasMore: false,
    })
  })

  it('finds nothing when no set has that size', async () => {
    const { client, calls } = setup([card('sv03.5-006', '006', 'Glurak-ex')])

    const result = await client.queryCards({ number: '6', officialCount: 999 }, 1)

    expect(result).toEqual({ cards: [], hasMore: false })
    expect(calls.some((call) => call.key === 'de/cards')).toBe(false)
  })

  it('filters a plain rarity exactly', async () => {
    const { client, cardParams } = setup([])

    await client.queryCards({ rarity: 'Selten' }, 1)

    expect(cardParams()).toMatchObject({ rarity: 'eq:Selten' })
  })

  it('filters a rarity with a comma through the rarity list', async () => {
    const { client, cardParams } = setup([
      card('sv03.5-166', '166', 'Bisasam'),
      card('sv03.5-198', '198', 'Bisaflor-ex'), // "Selten, besondere Illustration"
      card('sv03.5-170', '170', 'Pikachu'),
    ])

    const { cards } = await client.queryCards({ rarity: 'Selten, Illustration', setId: 'sv03.5' }, 1)

    expect(cardParams()).toMatchObject({ rarity: 'Illustration' })
    expect(cards.map((c) => c.id)).toEqual(['sv03.5-166', 'sv03.5-170'])
  })
})

describe('filter lists', () => {
  it('lists rarities alphabetically without those of the Pocket app', async () => {
    const { client } = setup()

    expect(await client.getRarities()).toEqual(['Häufig', 'Selten', 'Selten, Illustration'])
  })

  it('leaves out the Pocket rarities under their English names too', async () => {
    const client = createTcgdexClient({
      lang: 'en',
      cache: passThrough,
      graphql: noGraphql,
      transport: async () => ['Rare', 'One Diamond', 'Crown', 'Two Star', 'Common', 'Two Shiny'],
    })

    expect(await client.getRarities()).toEqual(['Common', 'Rare'])
  })

  it('lists types alphabetically', async () => {
    const { client } = setup()

    expect(await client.getTypes()).toEqual(['Elektro', 'Feuer', 'Wasser'])
  })
})
