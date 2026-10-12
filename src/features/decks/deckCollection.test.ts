import { describe, expect, it } from 'vitest'
import type { DeckCard } from '../../types/deck'
import { createBinder, setCard, setCount, setOwned } from '../binder/binderModel'
import { copiesAtHand, deckCoverage, deckWorth, ownedCopies } from './deckCollection'
import { addCard, createDeck, type DeckCardInfo } from './deckModel'

/** A binder holding the given cards: `[cardId, owned copies]`, 0 for a card that is missing. */
function binder(cards: [string, number][], lang: 'de' | 'en' = 'de') {
  let result = createBinder({ name: 'Kanto', layout: '3x3' })
  const page = result.pages[0]
  if (!page) throw new Error('a page expected')
  cards.forEach(([cardId, copies], slotIndex) => {
    const position = { pageId: page.id, slotIndex }
    result = setCard(result, position, { cardId, lang, variant: slotIndex % 2 === 0 ? 'normal' : 'reverse' })
    result = setOwned(result, position, copies > 0)
    if (copies > 1) result = setCount(result, position, copies)
  })
  return result
}

const deckOf = (cards: [string, number][]) =>
  cards.reduce((deck, [cardId, count]) => addCard(deck, cardId, 'de', count), createDeck('Donner'))

describe('ownedCopies', () => {
  it('counts what is marked as owned, over all binders and finishes, with the copies noted', () => {
    const owned = ownedCopies([
      binder([
        ['pikachu', 2],
        ['raichu', 0],
        ['pikachu', 1],
      ]),
      binder([['pikachu', 1]]),
    ])

    expect(owned.get('de:pikachu')).toBe(4)
    expect(owned.has('de:raichu')).toBe(false)
  })

  it('keeps the languages of a card apart', () => {
    const owned = ownedCopies([binder([['pikachu', 1]], 'en')])

    expect(owned.get('en:pikachu')).toBe(1)
    expect(owned.has('de:pikachu')).toBe(false)
  })
})

describe('how far the collection goes towards a deck', () => {
  const owned = ownedCopies([
    binder([
      ['pikachu', 6],
      ['raichu', 1],
    ]),
  ])

  it('counts no more copies of a card than the deck wants', () => {
    const deck = deckOf([
      ['pikachu', 4],
      ['raichu', 3],
      ['research', 2],
    ])

    expect(deck.cards.map((card) => copiesAtHand(card, owned))).toEqual([4, 1, 0])
    expect(deckCoverage(deck, owned)).toEqual({ have: 5, missing: 4 })
    expect(deckCoverage(createDeck('Leer'), owned)).toEqual({ have: 0, missing: 0 })
  })
})

describe('deckWorth', () => {
  const prices: Record<string, number> = { pikachu: 0.1, raichu: 0.2, research: 1.5 }
  const infoOf = (card: DeckCard): DeckCardInfo | undefined => {
    const price = prices[card.cardId]
    return card.cardId === 'unknown'
      ? undefined
      : { name: card.cardId, category: 'pokemon', basicEnergy: false, ...(price === undefined ? {} : { price }) }
  }

  it('adds up every copy, and apart from that what is not in the binders', () => {
    const deck = deckOf([
      ['pikachu', 3],
      ['raichu', 3],
      ['research', 2],
    ])
    const owned = ownedCopies([
      binder([
        ['pikachu', 3],
        ['raichu', 1],
      ]),
    ])

    // 3 × 0,10 + 3 × 0,20 + 2 × 1,50; missing are two Raichu and both trainers
    expect(deckWorth(deck, infoOf, owned)).toEqual({ worth: 3.9, missingWorth: 3.4, unpriced: 0 })
  })

  it('leaves out cards without a price and says how many they are', () => {
    const deck = deckOf([
      ['pikachu', 1],
      ['noprice', 4],
      ['unknown', 2],
    ])

    expect(deckWorth(deck, infoOf, new Map())).toEqual({ worth: 0.1, missingWorth: 0.1, unpriced: 6 })
  })
})
