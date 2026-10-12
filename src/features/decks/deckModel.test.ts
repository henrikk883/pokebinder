import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { DeckCard } from '../../types/deck'
import {
  addCard,
  checkDeck,
  countInDeck,
  createDeck,
  deckSize,
  groupDeck,
  isAllowed,
  renameDeck,
  setCardCount,
  setDeckCover,
  setFormat,
  type DeckCardInfo,
} from './deckModel'

const INFO: Record<string, DeckCardInfo> = {
  pikachu: { name: 'Pikachu', category: 'pokemon', basicEnergy: false },
  'pikachu-art': { name: 'Pikachu', category: 'pokemon', basicEnergy: false },
  raichu: { name: 'Raichu', category: 'pokemon', basicEnergy: false },
  research: { name: 'Forschung des Professors', category: 'trainer', basicEnergy: false },
  lightning: { name: 'Elektro-Energie', category: 'energy', basicEnergy: true },
  special: { name: 'Doppel-Turbo-Energie', category: 'energy', basicEnergy: false },
}
const infoOf = (card: DeckCard) => INFO[card.cardId]

describe('building a deck', () => {
  it('starts empty, for the standard format', () => {
    const deck = createDeck('  Donner  ', createTestContext())

    expect(deck).toMatchObject({ id: 'id-1', name: 'Donner', format: 'standard', cards: [] })
    expect(deck.createdAt).toBe(deck.updatedAt)
  })

  it('counts a card up when it is added again, and keeps the order cards came in', () => {
    const ctx = createTestContext()
    let deck = createDeck('Donner', ctx)
    deck = addCard(deck, 'pikachu', 'de', 1, ctx)
    deck = addCard(deck, 'raichu', 'de', 2, ctx)
    deck = addCard(deck, 'pikachu', 'de', 1, ctx)

    expect(deck.cards).toEqual([
      { cardId: 'pikachu', lang: 'de', count: 2 },
      { cardId: 'raichu', lang: 'de', count: 2 },
    ])
    expect(deckSize(deck)).toBe(4)
    expect(countInDeck(deck, 'pikachu', 'de')).toBe(2)
    expect(countInDeck(deck, 'pikachu', 'en')).toBe(0)
    expect(deck.updatedAt > deck.createdAt).toBe(true)
  })

  it('tells the same card in another language apart', () => {
    let deck = createDeck('Donner')
    deck = addCard(deck, 'pikachu', 'de')
    deck = addCard(deck, 'pikachu', 'en')

    expect(deck.cards).toHaveLength(2)
  })

  it('takes a card out when its last copy goes', () => {
    let deck = addCard(createDeck('Donner'), 'pikachu', 'de', 2)
    deck = addCard(deck, 'pikachu', 'de', -1)
    expect(countInDeck(deck, 'pikachu', 'de')).toBe(1)

    deck = addCard(deck, 'pikachu', 'de', -5)
    expect(deck.cards).toEqual([])
  })

  it('leaves the deck as it is when nothing changes', () => {
    const deck = addCard(createDeck('Donner'), 'pikachu', 'de')

    expect(setCardCount(deck, 'pikachu', 'de', 1)).toBe(deck)
    expect(setCardCount(deck, 'raichu', 'de', 0)).toBe(deck)
    expect(renameDeck(deck, '  ')).toBe(deck)
    expect(renameDeck(deck, 'Donner')).toBe(deck)
    expect(setDeckCover(deck, undefined)).toBe(deck)
  })

  it('renames, and puts a picture on the box and takes it off again', () => {
    const deck = createDeck('Donner')

    expect(renameDeck(deck, ' Blitz ').name).toBe('Blitz')
    const withPicture = setDeckCover(deck, 'asset-1')
    expect(withPicture.coverAssetId).toBe('asset-1')
    expect('coverAssetId' in setDeckCover(withPicture, undefined)).toBe(false)
  })
})

describe('what the rules say', () => {
  const build = (cards: [string, number][]) =>
    cards.reduce((deck, [cardId, count]) => addCard(deck, cardId, 'de', count), createDeck('Donner'))

  it('wants sixty cards', () => {
    expect(checkDeck(build([['pikachu', 4]]), infoOf)).toMatchObject({ size: 4, missing: 56, valid: false })
    const full = build([
      ['pikachu', 4],
      ['raichu', 4],
      ['research', 4],
      ['lightning', 48],
    ])
    expect(checkDeck(full, infoOf)).toEqual({ size: 60, missing: 0, tooMany: [], notAllowed: [], valid: true })
    expect(checkDeck(addCard(full, 'special', 'de'), infoOf)).toMatchObject({ size: 61, missing: -1, valid: false })
  })

  it('allows four of a name, counted across the prints of that name', () => {
    const deck = build([
      ['pikachu', 3],
      ['pikachu-art', 2],
      ['raichu', 4],
    ])

    expect(checkDeck(deck, infoOf).tooMany).toEqual([{ name: 'Pikachu', count: 5 }])
  })

  it('lets basic energy be in as often as one likes, special energy not', () => {
    const deck = build([
      ['lightning', 20],
      ['special', 5],
    ])

    expect(checkDeck(deck, infoOf).tooMany).toEqual([{ name: 'Doppel-Turbo-Energie', count: 5 }])
  })

  it('counts a card it knows nothing about for itself', () => {
    const deck = build([
      ['mystery', 5],
      ['other', 4],
    ])

    expect(checkDeck(deck, infoOf).tooMany).toEqual([{ name: 'mystery', count: 5 }])
  })
})

describe('the format of a deck', () => {
  const rotated: DeckCardInfo = { name: 'Qurtel V', category: 'pokemon', basicEnergy: false, legal: { standard: false, expanded: true } }
  const current: DeckCardInfo = { name: 'Pikachu-ex', category: 'pokemon', basicEnergy: false, legal: { standard: true, expanded: true } }
  const unsure: DeckCardInfo = { name: 'Rätsel', category: 'pokemon', basicEnergy: false }
  const infos: Record<string, DeckCardInfo> = { rotated, 'rotated-art': rotated, current, unsure }
  const lookUp = (card: DeckCard) => infos[card.cardId]

  it('says for each format whether a card may be played, as far as that is known', () => {
    expect(isAllowed(rotated, 'standard')).toBe(false)
    expect(isAllowed(rotated, 'expanded')).toBe(true)
    expect(isAllowed(rotated, 'free')).toBe(true)
    expect(isAllowed(unsure, 'standard')).toBeUndefined()
    expect(isAllowed(undefined, 'standard')).toBeUndefined()
    expect(isAllowed(undefined, 'free')).toBe(true)
  })

  it('objects to the cards that are known not to be allowed, by name', () => {
    let deck = createDeck('Format')
    for (const [cardId, count] of [
      ['rotated', 2],
      ['current', 4],
      ['rotated-art', 1],
      ['unsure', 1],
      ['never heard of', 1],
    ] as const) {
      deck = addCard(deck, cardId, 'de', count)
    }

    expect(checkDeck(deck, lookUp).notAllowed).toEqual([{ name: 'Qurtel V', count: 3 }])
    expect(checkDeck(setFormat(deck, 'expanded'), lookUp).notAllowed).toEqual([])
    expect(checkDeck(setFormat(deck, 'free'), lookUp).notAllowed).toEqual([])
  })

  it('makes a deck of the right size invalid as long as a card is not allowed', () => {
    let deck = addCard(createDeck('Format'), 'rotated', 'de', 4)
    deck = addCard(deck, 'lightning', 'de', 56)
    const info = (card: DeckCard) => (card.cardId === 'rotated' ? rotated : INFO[card.cardId])

    expect(checkDeck(deck, info).valid).toBe(false)
    expect(checkDeck(setFormat(deck, 'expanded'), info).valid).toBe(true)
  })

  it('changes the format and nothing else', () => {
    const deck = addCard(createDeck('Format'), 'rotated', 'de', 2)

    expect(setFormat(deck, 'standard')).toBe(deck)
    const free = setFormat(deck, 'free')
    expect(free.format).toBe('free')
    expect(free.cards).toBe(deck.cards)
  })
})

describe('the cards by kind', () => {
  it('lists Pokémon, trainers and energy in that order, then what is not known', () => {
    let deck = createDeck('Donner')
    for (const [cardId, count] of [
      ['lightning', 10],
      ['mystery', 1],
      ['research', 2],
      ['pikachu', 3],
      ['raichu', 1],
    ] as const) {
      deck = addCard(deck, cardId, 'de', count)
    }

    expect(groupDeck(deck, infoOf).map((group) => [group.category, group.count, group.cards.map((card) => card.cardId)])).toEqual([
      ['pokemon', 4, ['pikachu', 'raichu']],
      ['trainer', 2, ['research']],
      ['energy', 10, ['lightning']],
      ['unknown', 1, ['mystery']],
    ])
    expect(groupDeck(createDeck('Leer'), infoOf)).toEqual([])
  })
})
