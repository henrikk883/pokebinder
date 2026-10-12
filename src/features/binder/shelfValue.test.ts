import { describe, expect, it } from 'vitest'
import { createBinder, setCard, setOwned } from './binderModel'
import { needsValue, parseShelfValues, replacesStored, shelfTotal, VALUE_MAX_AGE_MS, type StoredValue } from './shelfValue'

const ref = (cardId: string) => ({ cardId, lang: 'de', variant: 'normal' }) as const

/** A binder with `cards` cards, the first `owned` of them marked as owned. */
function binder(name: string, cards: number, owned: number) {
  let result = createBinder({ name, layout: '3x3' })
  const page = result.pages[0]
  if (!page) throw new Error('a page expected')
  for (let slotIndex = 0; slotIndex < cards; slotIndex++) {
    const position = { pageId: page.id, slotIndex }
    result = setOwned(setCard(result, position, ref(`sv03.5-00${slotIndex + 1}`)), position, slotIndex < owned)
  }
  return result
}

const noon = Date.parse('2026-10-12T12:00:00.000Z')
const stored = (updatedAt: string, owned: number, unpriced = 0, at = '2026-10-12T11:00:00.000Z'): StoredValue => ({
  updatedAt,
  at,
  value: { owned, missing: 0, unpriced },
})

describe('needsValue', () => {
  const kanto = binder('Kanto', 3, 2)

  it('asks for a value where there is none, or the binder changed since', () => {
    expect(needsValue(kanto, undefined, noon)).toBe(true)
    expect(needsValue(kanto, stored('an earlier state', 5), noon)).toBe(true)
    expect(needsValue(kanto, stored(kanto.updatedAt, 5), noon)).toBe(false)
  })

  it('asks again after a day, and when the clock makes no sense', () => {
    const old = new Date(noon - VALUE_MAX_AGE_MS).toISOString()
    const future = new Date(noon + 60_000).toISOString()

    expect(needsValue(kanto, stored(kanto.updatedAt, 5, 0, old), noon)).toBe(true)
    expect(needsValue(kanto, stored(kanto.updatedAt, 5, 0, future), noon)).toBe(true)
    expect(needsValue(kanto, stored(kanto.updatedAt, 5, 0, 'gestern'), noon)).toBe(true)
  })
})

describe('replacesStored', () => {
  const kanto = binder('Kanto', 3, 2)

  it('takes a new value', () => {
    expect(replacesStored(kanto, { owned: 7, missing: 1, unpriced: 0 }, undefined)).toBe(true)
    expect(replacesStored(kanto, { owned: 7, missing: 1, unpriced: 1 }, stored(kanto.updatedAt, 5))).toBe(true)
  })

  it('keeps what was known when no card at all came back with a price, as without a connection', () => {
    const nothing = { owned: 0, missing: 0, unpriced: 3 }

    expect(replacesStored(kanto, nothing, stored(kanto.updatedAt, 5))).toBe(false)
    // nothing was known before either: then that is the state of things
    expect(replacesStored(kanto, nothing, undefined)).toBe(true)
    expect(replacesStored(kanto, nothing, stored(kanto.updatedAt, 0, 3))).toBe(true)
  })
})

describe('shelfTotal', () => {
  it('adds up cards and worth over all binders', () => {
    const kanto = binder('Kanto', 3, 2)
    const johto = binder('Johto', 4, 4)

    expect(
      shelfTotal([kanto, johto], { [kanto.id]: stored(kanto.updatedAt, 10.1), [johto.id]: stored(johto.updatedAt, 0.2) }),
    ).toEqual({ owned: 6, cards: 7, worth: 10.3, pending: 0 })
  })

  it('says how many binders still wait for their value; empty ones do not', () => {
    const kanto = binder('Kanto', 3, 2)
    const johto = binder('Johto', 4, 0)
    const empty = binder('Leer', 0, 0)

    expect(shelfTotal([kanto, johto, empty], { [kanto.id]: stored('older', 12) })).toEqual({
      owned: 2,
      cards: 7,
      worth: 12,
      pending: 1,
    })
    expect(shelfTotal([], {})).toEqual({ owned: 0, cards: 0, worth: 0, pending: 0 })
  })
})

describe('parseShelfValues', () => {
  it('reads what was stored and leaves out what cannot be read', () => {
    const good = stored('2026-10-12T10:00:00.000Z', 12.5, 1)

    expect(
      parseShelfValues(
        JSON.stringify({
          a: good,
          b: { updatedAt: 'x', at: 'y' },
          c: { updatedAt: 'x', at: 'y', value: { owned: 'viel', missing: 0, unpriced: 0 } },
          d: null,
        }),
      ),
    ).toEqual({ a: good })
    expect(parseShelfValues('not json')).toEqual({})
    expect(parseShelfValues('[1]')).toEqual({})
    expect(parseShelfValues(null)).toEqual({})
  })
})
