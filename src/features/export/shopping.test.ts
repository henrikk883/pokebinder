import { describe, expect, it } from 'vitest'
import {
  cardmarketUrl,
  parseBudget,
  shoppingTotal,
  sortShopping,
  withinBudget,
  type ShoppingRow,
} from './shopping'

const row = (key: string, price?: number): ShoppingRow => ({
  key,
  cardId: `sv03.5-${key}`,
  lang: 'de',
  variant: 'normal',
  name: `Karte ${key}`,
  setName: '151',
  number: `${key}/165`,
  ...(price === undefined ? {} : { price }),
})

const keys = (rows: ShoppingRow[]) => rows.map((entry) => entry.key)

describe('sortShopping', () => {
  const rows = [row('a', 5), row('b'), row('c', 0.5), row('d', 20), row('e')]

  it('puts the cheapest first, cards without a price last', () => {
    expect(keys(sortShopping(rows, 'cheapest'))).toEqual(['c', 'a', 'd', 'b', 'e'])
  })

  it('puts the dearest first, cards without a price last as well', () => {
    expect(keys(sortShopping(rows, 'dearest'))).toEqual(['d', 'a', 'c', 'b', 'e'])
  })

  it('keeps the order of the binder, and the given list as it is', () => {
    expect(keys(sortShopping(rows, 'binder'))).toEqual(['a', 'b', 'c', 'd', 'e'])
    sortShopping(rows, 'cheapest')
    expect(keys(rows)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('withinBudget', () => {
  const rows = [row('a', 5), row('b'), row('c', 0.5), row('d', 20), row('e', 4.5)]

  it('buys the cheapest cards first and stops where the money ends', () => {
    const result = withinBudget(rows, 10)

    expect([...result.affordable]).toEqual(['c', 'e', 'a'])
    expect(result.spent).toBe(10)
  })

  it('does not skip a card to fit a dearer one in later', () => {
    // 0.5 + 4.5 fit into 9; the next, 5, does not, and nothing after it is tried
    expect([...withinBudget(rows, 9).affordable]).toEqual(['c', 'e'])
    expect(withinBudget(rows, 9).spent).toBe(5)
  })

  it('gets everything that has a price with enough money, and nothing with none', () => {
    expect(withinBudget(rows, 1000).affordable.size).toBe(4)
    expect(withinBudget(rows, 1000).spent).toBe(30)
    expect(withinBudget(rows, 0).affordable.size).toBe(0)
    expect(withinBudget([], 50)).toEqual({ affordable: new Set(), spent: 0 })
  })

  it('counts in cents, so that small amounts add up exactly', () => {
    const cheap = [row('a', 0.1), row('b', 0.2)]

    expect(withinBudget(cheap, 0.3).affordable.size).toBe(2)
    expect(withinBudget(cheap, 0.3).spent).toBe(0.3)
  })
})

describe('shoppingTotal', () => {
  it('adds up the prices and counts the cards without one', () => {
    expect(shoppingTotal([row('a', 5), row('b'), row('c', 0.55)])).toEqual({ total: 5.55, unpriced: 1 })
    expect(shoppingTotal([])).toEqual({ total: 0, unpriced: 0 })
  })
})

describe('parseBudget', () => {
  it('reads amounts as they are typed in German', () => {
    expect(parseBudget('50')).toBe(50)
    expect(parseBudget('49,90')).toBe(49.9)
    expect(parseBudget(' 1.200,50 € ')).toBe(1200.5)
    expect(parseBudget('49.90')).toBe(49.9)
    expect(parseBudget('0')).toBe(0)
  })

  it('has no amount for anything else', () => {
    expect(parseBudget('')).toBeUndefined()
    expect(parseBudget('viel')).toBeUndefined()
    expect(parseBudget('-5')).toBeUndefined()
    expect(parseBudget('1,2,3')).toBeUndefined()
  })
})

describe('cardmarketUrl', () => {
  it('leads to the product where its number is known', () => {
    expect(cardmarketUrl({ name: 'Pikachu', cardmarketId: 733620 })).toBe(
      'https://www.cardmarket.com/de/Pokemon/Products?idProduct=733620',
    )
  })

  it('searches for the name otherwise', () => {
    expect(cardmarketUrl({ name: 'Pikachu & Zekrom-GX' })).toBe(
      'https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=Pikachu%20%26%20Zekrom-GX',
    )
  })
})
