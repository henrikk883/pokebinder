import { describe, expect, it, vi } from 'vitest'
import type { CardPage, CardSummary } from '../../lib/tcgdex'
import { parseSearchText, planSearch, runSearch } from './searchLogic'

describe('parseSearchText', () => {
  it.each([
    ['Glurak', { name: 'Glurak' }],
    ['  Mega-Glurak X-ex  ', { name: 'Mega-Glurak X-ex' }],
    ['025', { number: '025' }],
    ['Pikachu 25', { name: 'Pikachu', number: '25' }],
    ['188/125', { number: '188', officialCount: 125 }],
    ['025/165 Pikachu', { name: 'Pikachu', number: '025', officialCount: 165 }],
    ['188/125 7', { number: '7' }],
    ['Porygon2', { name: 'Porygon2' }],
    ['', {}],
    ['   ', {}],
  ])('reads %j', (text, expected) => {
    expect(parseSearchText(text)).toEqual(expected)
  })
})

describe('planSearch', () => {
  it('waits for input', () => {
    expect(planSearch({ text: '' })).toEqual({ kind: 'idle' })
    expect(planSearch({ text: '  ' })).toEqual({ kind: 'idle' })
  })

  it('waits for a second letter before searching all sets', () => {
    expect(planSearch({ text: 'G' })).toEqual({ kind: 'idle' })
    expect(planSearch({ text: 'Gl' })).toEqual({ kind: 'query', query: { name: 'Gl' } })
  })

  it('shows the whole set when only a set is chosen', () => {
    expect(planSearch({ text: '', setId: 'sv03.5' })).toEqual({ kind: 'set', setId: 'sv03.5' })
  })

  it('searches inside a set from the first letter', () => {
    expect(planSearch({ text: 'G', setId: 'sv03.5' })).toEqual({
      kind: 'query',
      query: { name: 'G', setId: 'sv03.5' },
    })
  })

  it('finds a number inside a set or next to a name', () => {
    expect(planSearch({ text: '25', setId: 'sv03.5' })).toEqual({
      kind: 'query',
      query: { number: '25', setId: 'sv03.5' },
    })
    expect(planSearch({ text: 'Pikachu 25' })).toEqual({
      kind: 'query',
      query: { name: 'Pikachu', number: '25' },
    })
  })

  it('searches a number as printed on the card across all sets of that size', () => {
    expect(planSearch({ text: '188/125' })).toEqual({
      kind: 'query',
      query: { number: '188', officialCount: 125 },
    })
  })

  it('uses the chosen set instead of the printed set size', () => {
    expect(planSearch({ text: '188/125', setId: 'sv03.5' })).toEqual({
      kind: 'query',
      query: { number: '188', setId: 'sv03.5' },
    })
  })

  it('asks for more when only a number is given', () => {
    expect(planSearch({ text: '25' })).toEqual({ kind: 'needsContext' })
    expect(planSearch({ text: '25', rarity: 'Selten' })).toEqual({ kind: 'needsContext' })
    expect(planSearch({ text: 'P 25' })).toEqual({ kind: 'needsContext' })
  })

  it('searches by rarity or type alone', () => {
    expect(planSearch({ text: '', rarity: 'Selten' })).toEqual({
      kind: 'query',
      query: { rarity: 'Selten' },
    })
    expect(planSearch({ text: '', type: 'Feuer', setId: 'sv03.5' })).toEqual({
      kind: 'query',
      query: { type: 'Feuer', setId: 'sv03.5' },
    })
  })

  it('combines all filters', () => {
    expect(
      planSearch({ text: 'Glurak 6', setId: 'sv03.5', rarity: 'Doppelselten', type: 'Feuer' }),
    ).toEqual({
      kind: 'query',
      query: { name: 'Glurak', number: '6', setId: 'sv03.5', rarity: 'Doppelselten', type: 'Feuer' },
    })
  })
})

describe('a name typed in another language', () => {
  const enton: CardSummary = { id: 'sv03.5-054', localId: '054', name: 'Enton' }
  const entoron: CardSummary = { id: 'sv03.5-055', localId: '055', name: 'Entoron' }

  /** German cards: found by German name, or by Pokédex number. */
  function german(byDexId: Record<number, CardSummary[]>, pageSize = 60) {
    return {
      getSetCards: vi.fn(async () => []),
      queryCards: vi.fn(async (query: { name?: string; dexId?: number; setId?: string }, page: number) => {
        const all = query.dexId !== undefined ? (byDexId[query.dexId] ?? []) : query.name === 'Enton' ? [enton] : []
        const cards = all.slice((page - 1) * pageSize, page * pageSize)
        return { cards, hasMore: all.length > page * pageSize }
      }),
    }
  }
  const english = (dexIds: number[]) => ({ dexIdsOfName: vi.fn(async () => dexIds) })
  const plan = (name: string, setId?: string) =>
    ({ kind: 'query', query: { name, ...(setId ? { setId } : {}) } }) as const

  it('leads to the cards of that Pokémon in the language of the search', async () => {
    const client = german({ 54: [enton] })
    const other = english([54])

    expect(await runSearch(client, plan('psyduck'), 1, [other])).toEqual({ cards: [enton], hasMore: false })
    expect(other.dexIdsOfName).toHaveBeenCalledWith('psyduck')
    // the other filters stay, the name goes
    await runSearch(client, plan('psyduck', 'sv03.5'), 1, [other])
    expect(client.queryCards).toHaveBeenLastCalledWith({ setId: 'sv03.5', dexId: 54 }, 1)
  })

  it('is not asked about while the name finds something as it is', async () => {
    const client = german({})
    const other = english([54])

    expect(await runSearch(client, plan('Enton'), 1, [other])).toEqual({ cards: [enton], hasMore: false })
    expect(other.dexIdsOfName).not.toHaveBeenCalled()
  })

  it('may stand for several Pokémon, each card once', async () => {
    const client = german({ 54: [enton], 55: [entoron, enton] })

    const found = await runSearch(client, plan('duck'), 1, [english([54, 55])])

    expect(found.cards).toEqual([enton, entoron])
  })

  it('tries the languages in turn and finds nothing where none knows the name', async () => {
    const client = german({ 54: [enton] })
    const french = english([])
    const other = english([54])

    expect((await runSearch(client, plan('psyduck'), 1, [french, other])).cards).toEqual([enton])
    expect(await runSearch(client, plan('xyzzy'), 1, [french, english([])])).toEqual({ cards: [], hasMore: false })
    // a language that cannot be asked is like one that knows nothing
    const broken = { dexIdsOfName: vi.fn(async () => Promise.reject(new Error('offline'))) }
    expect((await runSearch(client, plan('psyduck'), 1, [broken, other])).cards).toEqual([enton])
  })

  it('goes on to the next page of that Pokémon, not back to the name', async () => {
    const many = Array.from({ length: 3 }, (_, i): CardSummary => ({ id: `set-${i}`, localId: String(i), name: 'Enton' }))
    const client = german({ 54: many }, 2)
    const other = english([54])

    expect(await runSearch(client, plan('psyduck'), 1, [other])).toEqual({ cards: many.slice(0, 2), hasMore: true })
    expect(await runSearch(client, plan('psyduck'), 2, [other])).toEqual({ cards: many.slice(2), hasMore: false })
  })

  it('is always asked about for Japanese cards, where a western name may find a stray card as it is', async () => {
    const stray: CardSummary = { id: 'neo2-049', localId: '049', name: 'Eevee' }
    const eievui: CardSummary = { id: 'SV2a-133', localId: '133', name: 'イーブイ' }
    const japanese = {
      lang: 'ja' as const,
      getSetCards: vi.fn(async () => []),
      queryCards: vi.fn(async (query: { name?: string; dexId?: number }) => ({
        cards: query.dexId === 133 ? [eievui, stray] : query.name === 'Eevee' ? [stray] : query.name === 'イーブイ' ? [eievui] : [],
        hasMore: false,
      })),
    }
    const other = english([133])

    // the card found as it is comes first, each card once
    expect(await runSearch(japanese, plan('Eevee'), 1, [other])).toEqual({ cards: [stray, eievui], hasMore: false })
    // a name in Japanese letters that finds cards is looked for as it is, nothing else
    other.dexIdsOfName.mockClear()
    expect(await runSearch(japanese, plan('イーブイ'), 1, [other])).toEqual({ cards: [eievui], hasMore: false })
    expect(other.dexIdsOfName).not.toHaveBeenCalled()
  })

  it('leaves an empty later page of a name that does find cards alone', async () => {
    const client = german({ 54: [entoron] })
    const other = english([54])

    expect(await runSearch(client, plan('Enton'), 2, [other])).toEqual({ cards: [], hasMore: false })
    expect(other.dexIdsOfName).not.toHaveBeenCalled()
  })
})

describe('runSearch', () => {
  const bisasam: CardSummary = { id: 'sv03.5-001', localId: '001', name: 'Bisasam' }

  function fakeClient(page: CardPage = { cards: [bisasam], hasMore: true }) {
    return {
      getSetCards: vi.fn(async () => [bisasam]),
      queryCards: vi.fn(async () => page),
    }
  }

  it('loads nothing while there is nothing to search', async () => {
    const client = fakeClient()

    expect(await runSearch(client, { kind: 'idle' }, 1)).toEqual({ cards: [], hasMore: false })
    expect(await runSearch(client, { kind: 'needsContext' }, 1)).toEqual({ cards: [], hasMore: false })
    expect(client.getSetCards).not.toHaveBeenCalled()
    expect(client.queryCards).not.toHaveBeenCalled()
  })

  it('loads the complete set for a set plan', async () => {
    const client = fakeClient()

    const result = await runSearch(client, { kind: 'set', setId: 'sv03.5' }, 1)

    expect(client.getSetCards).toHaveBeenCalledWith('sv03.5')
    expect(result).toEqual({ cards: [bisasam], hasMore: false })
  })

  it('passes query and page on', async () => {
    const client = fakeClient()

    const result = await runSearch(client, { kind: 'query', query: { name: 'Bisasam' } }, 2)

    expect(client.queryCards).toHaveBeenCalledWith({ name: 'Bisasam' }, 2)
    expect(result).toEqual({ cards: [bisasam], hasMore: true })
  })
})

describe('searching by illustrator and kind of card', () => {
  it('needs nothing else to search by', () => {
    expect(planSearch({ text: '', illustrator: 'Mitsuhiro Arita' })).toEqual({
      kind: 'query',
      query: { illustrator: 'Mitsuhiro Arita' },
    })
    expect(planSearch({ text: '', category: 'Trainer' })).toEqual({ kind: 'query', query: { category: 'Trainer' } })
  })

  it('goes together with name, set and the other filters', () => {
    expect(planSearch({ text: 'Glurak', setId: 'sv03.5', illustrator: ' Arita ', category: 'Pokémon' })).toEqual({
      kind: 'query',
      query: { name: 'Glurak', setId: 'sv03.5', illustrator: 'Arita', category: 'Pokémon' },
    })
  })

  it('waits for more than a letter of the name of an artist', () => {
    expect(planSearch({ text: '', illustrator: 'A' })).toEqual({ kind: 'idle' })
    expect(planSearch({ text: '', setId: 'sv03.5', illustrator: 'A' })).toEqual({ kind: 'set', setId: 'sv03.5' })
  })
})
