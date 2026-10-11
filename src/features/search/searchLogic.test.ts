import { describe, expect, it, vi } from 'vitest'
import type { CardPage, CardSummary } from '../../lib/tcgdex'
import { parseSearchText, planSearch, runSearch } from './searchLogic'

describe('parseSearchText', () => {
  it.each([
    ['Glurak', { name: 'Glurak' }],
    ['  Mega-Glurak X-ex  ', { name: 'Mega-Glurak X-ex' }],
    ['025', { number: '025' }],
    ['Pikachu 25', { name: 'Pikachu', number: '25' }],
    ['025/165 Pikachu', { name: 'Pikachu', number: '025' }],
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
