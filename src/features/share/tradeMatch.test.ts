import { describe, expect, it } from 'vitest'
import type { CardLang, CardVariant } from '../../types/binder'
import { createBinder, setCard, setCount, setOwned } from '../binder/binderModel'
import { matchTrade, missingCards, spareCards, tradable } from './tradeMatch'

type Entry = [cardId: string, copies: number, variant?: CardVariant, lang?: CardLang]

/** A binder holding the given cards; `copies` 0 is a card that is missing. */
function binder(entries: Entry[]) {
  let result = createBinder({ name: 'Test', layout: '3x3' })
  const page = result.pages[0]
  if (!page) throw new Error('a page expected')
  entries.forEach(([cardId, copies, variant = 'normal', lang = 'de'], slotIndex) => {
    const position = { pageId: page.id, slotIndex }
    result = setCard(result, position, { cardId, lang, variant })
    result = setOwned(result, position, copies > 0)
    if (copies > 1) result = setCount(result, position, copies)
  })
  return result
}

const ids = (cards: { cardRef: { cardId: string }; count: number }[]) => cards.map((card) => `${card.cardRef.cardId}×${card.count}`)

describe('what is spare and what is missing', () => {
  it('counts the copies beyond the one in the pocket, over all binders', () => {
    const spare = spareCards([binder([['pikachu', 3], ['raichu', 1], ['mew', 0]]), binder([['pikachu', 2]])])

    expect([...spare.values()].map((card) => [card.cardRef.cardId, card.count])).toEqual([['pikachu', 3]])
  })

  it('counts the pockets that wait for a card', () => {
    const missing = missingCards([binder([['mew', 0], ['pikachu', 1]]), binder([['mew', 0]])])

    expect([...missing.values()].map((card) => [card.cardRef.cardId, card.count])).toEqual([['mew', 2]])
  })
})

describe('tradable', () => {
  it('finds the spare cards of one collector that the other is missing', () => {
    const giver = [binder([['pikachu', 3], ['raichu', 2], ['mew', 1]])]
    const taker = [binder([['pikachu', 0], ['mew', 0], ['raichu', 1]])]

    // Raichu is there already, Mew is not spare
    expect(ids(tradable(giver, taker))).toEqual(['pikachu×1'])
  })

  it('hands over no more copies than are spare, and no more than are missing', () => {
    const giver = [binder([['pikachu', 4], ['raichu', 2]])]
    const taker = [binder([['pikachu', 0], ['raichu', 0]]), binder([['raichu', 0], ['pikachu', 0]]), binder([['raichu', 0]])]

    expect(ids(tradable(giver, taker))).toEqual(['pikachu×2', 'raichu×1'])
  })

  it('tells finishes and languages apart', () => {
    const giver = [binder([['pikachu', 2, 'reverse'], ['mew', 2, 'normal', 'en']])]

    expect(tradable(giver, [binder([['pikachu', 0, 'normal'], ['mew', 0, 'normal', 'de']])])).toEqual([])
    expect(ids(tradable(giver, [binder([['pikachu', 0, 'reverse'], ['mew', 0, 'normal', 'en']])]))).toEqual([
      'pikachu×1',
      'mew×1',
    ])
  })
})

describe('matchTrade', () => {
  it('looks both ways', () => {
    const mine = [binder([['pikachu', 2], ['mew', 0]])]
    const theirs = [binder([['pikachu', 0], ['mew', 3]])]

    const match = matchTrade(mine, theirs)

    expect(ids(match.forMe)).toEqual(['mew×1'])
    expect(ids(match.forThem)).toEqual(['pikachu×1'])
  })

  it('finds nothing where nobody has anything spare', () => {
    expect(matchTrade([binder([['pikachu', 1]])], [binder([['pikachu', 0]])])).toEqual({ forMe: [], forThem: [] })
    expect(matchTrade([], [])).toEqual({ forMe: [], forThem: [] })
  })
})
