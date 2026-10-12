import { describe, expect, it } from 'vitest'
import { parseWatchlists, QUICK_LIST_ID, setWishPrice, toggleInList, type Watchlist } from './watchlist'
import { cardsWithWish, isBelowWish, parseAmount } from './wishPrice'

const monday = '2026-10-12T10:00:00.000Z'

function lists(): Watchlist[] {
  let result: Watchlist[] = [
    { id: QUICK_LIST_ID, name: '', cards: [] },
    { id: 'buy', name: 'Kaufen', cards: [] },
  ]
  result = toggleInList(result, QUICK_LIST_ID, 'sv03.5-025', 'de', monday)
  result = toggleInList(result, 'buy', 'sv03.5-025', 'de', monday)
  result = toggleInList(result, 'buy', 'sv03.5-006', 'de', monday)
  return result
}

describe('parseAmount', () => {
  it('reads amounts as they are typed', () => {
    expect(parseAmount('5')).toBe(5)
    expect(parseAmount('5,50')).toBe(5.5)
    expect(parseAmount('5.5')).toBe(5.5)
    expect(parseAmount(' 12,99 € ')).toBe(12.99)
  })

  it('takes nothing else for an amount', () => {
    for (const text of ['', 'fünf', '0', '-3', '1,234', '1.000,00', '5,']) expect(parseAmount(text)).toBeUndefined()
  })
})

describe('a wish price on a noted card', () => {
  it('is set for the card on that list only, and taken off again', () => {
    const wished = setWishPrice(lists(), 'buy', 'sv03.5-025', 'de', 4.5)

    expect(wished[1]?.cards.find((card) => card.cardId === 'sv03.5-025')?.wishPrice).toBe(4.5)
    expect(wished[0]?.cards[0]?.wishPrice).toBeUndefined()
    const cleared = setWishPrice(wished, 'buy', 'sv03.5-025', 'de', undefined)
    expect('wishPrice' in (cleared[1]?.cards.find((card) => card.cardId === 'sv03.5-025') ?? {})).toBe(false)
  })

  it('changes nothing for a card that is not on the list', () => {
    const before = lists()

    expect(setWishPrice(before, QUICK_LIST_ID, 'sv03.5-006', 'de', 3)).toEqual(before)
    expect(setWishPrice(before, 'unknown', 'sv03.5-025', 'de', 3)).toEqual(before)
  })

  it('is kept when the lists are stored and read again, unless it makes no sense', () => {
    const wished = setWishPrice(lists(), 'buy', 'sv03.5-025', 'de', 4.5)

    expect(parseWatchlists(JSON.stringify(wished))).toEqual(wished)
    const odd = JSON.stringify([{ id: QUICK_LIST_ID, name: '', cards: [{ cardId: 'a', lang: 'de', savedAt: monday, wishPrice: 'viel' }] }])
    expect(parseWatchlists(odd)[0]?.cards).toEqual([{ cardId: 'a', lang: 'de', savedAt: monday }])
    const negative = JSON.stringify([{ id: QUICK_LIST_ID, name: '', cards: [{ cardId: 'a', lang: 'de', savedAt: monday, wishPrice: -1 }] }])
    expect(parseWatchlists(negative)[0]?.cards).toEqual([{ cardId: 'a', lang: 'de', savedAt: monday }])
  })
})

describe('which cards to watch', () => {
  it('names every card with a wish once, with the highest wish if lists differ', () => {
    let wished = setWishPrice(lists(), 'buy', 'sv03.5-025', 'de', 4.5)
    wished = setWishPrice(wished, QUICK_LIST_ID, 'sv03.5-025', 'de', 6)

    expect(cardsWithWish(wished).map((card) => [card.cardId, card.wishPrice])).toEqual([['sv03.5-025', 6]])
    expect(cardsWithWish(lists())).toEqual([])
  })

  it('counts a card as there for the taking at the wish price or below', () => {
    expect(isBelowWish(4.5, 4.5)).toBe(true)
    expect(isBelowWish(4.49, 4.5)).toBe(true)
    expect(isBelowWish(4.51, 4.5)).toBe(false)
    expect(isBelowWish(undefined, 4.5)).toBe(false)
    expect(isBelowWish(4, undefined)).toBe(false)
  })
})
