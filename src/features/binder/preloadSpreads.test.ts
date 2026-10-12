import { describe, expect, it } from 'vitest'
import { addPage, createBinder, setCard } from './binderModel'
import { cardsOfSpread } from './preloadSpreads'
import { buildSpreads } from './spreads'

const ref = (cardId: string) => ({ cardId, lang: 'de', variant: 'normal' }) as const

function binderWithCards() {
  let binder = addPage(addPage(createBinder({ name: 'Kanto', layout: '2x2' })))
  const [first, second, third] = binder.pages
  if (!first || !second || !third) throw new Error('three pages expected')
  binder = setCard(binder, { pageId: first.id, slotIndex: 0 }, ref('sv03.5-001'))
  binder = setCard(binder, { pageId: second.id, slotIndex: 1 }, ref('sv03.5-002'))
  binder = setCard(binder, { pageId: third.id, slotIndex: 3 }, ref('sv03.5-003'))
  return binder
}

describe('cardsOfSpread', () => {
  it('names the cards of both open pages; the inside of the cover holds none', () => {
    const binder = binderWithCards()
    const spreads = buildSpreads(binder.pages.length)

    expect(cardsOfSpread(binder, spreads[0]).map((card) => card.cardId)).toEqual(['sv03.5-001'])
    expect(cardsOfSpread(binder, spreads[1]).map((card) => card.cardId)).toEqual(['sv03.5-002', 'sv03.5-003'])
  })

  it('has nothing for a spread that is not there, e.g. before the first one', () => {
    const binder = binderWithCards()
    const spreads = buildSpreads(binder.pages.length)

    expect(cardsOfSpread(binder, spreads[-1])).toEqual([])
    expect(cardsOfSpread(binder, spreads[spreads.length])).toEqual([])
  })

  it('goes page by page where one page lies open at a time', () => {
    const binder = binderWithCards()
    const spreads = buildSpreads(binder.pages.length, true)

    expect(spreads.map((spread) => cardsOfSpread(binder, spread).map((card) => card.cardId))).toEqual([
      ['sv03.5-001'],
      ['sv03.5-002'],
      ['sv03.5-003'],
    ])
  })
})
