import { describe, expect, it } from 'vitest'
import { cardsFitting, lookLikeness, similarCards, type LookIndex } from './similarCards'
import { SIGNATURE_LENGTH, type ColourIndex } from './similarColours'

/** Cards given by one colour bin each; the first `rare` are of the high rarities. */
function coloursOf(cards: Record<string, number>, rare: number): ColourIndex {
  const ids = Object.keys(cards)
  const signatures = new Uint8Array(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, position) => {
    signatures[position * SIGNATURE_LENGTH + (cards[id] ?? 0)] = 255
  })
  return { ids, rare, signatures }
}

/** What the model sees, two numbers per card. */
function looksOf(cards: Record<string, [number, number]>): LookIndex {
  const ids = Object.keys(cards)
  return { ids, size: 2, rows: Int8Array.from(ids.flatMap((id) => cards[id] ?? [0, 0])), themes: [] }
}

describe('lookLikeness', () => {
  const looks = looksOf({ a: [100, 0], same: [50, 0], other: [0, 80], half: [60, 60], empty: [0, 0] })

  it('is 1 for rows pointing the same way, whatever their length, and 0 for unlike ones', () => {
    expect(lookLikeness(looks, 0, 1)).toBeCloseTo(1)
    expect(lookLikeness(looks, 0, 2)).toBe(0)
    expect(lookLikeness(looks, 0, 3)).toBeCloseTo(Math.SQRT1_2)
  })

  it('takes a card without numbers as unlike everything', () => {
    expect(lookLikeness(looks, 0, 4)).toBe(0)
  })
})

describe('similarCards', () => {
  const colours = coloursOf({ query: 1, sameLook: 9, sameColour: 1, neither: 9, common: 1 }, 4)
  const looks = looksOf({ query: [100, 0], sameLook: [100, 5], sameColour: [60, 80], neither: [0, 100] })

  it('puts what the model sees before the colours, and both before neither', () => {
    expect(similarCards(colours, looks, 'query', 3)).toEqual(['sameLook', 'sameColour', 'neither'])
  })

  it('lets the colours decide between cards the model finds equally alike', () => {
    const twins = looksOf({ query: [100, 0], sameLook: [50, 50], sameColour: [50, 50], neither: [50, 50] })
    expect(similarCards(colours, twins, 'query', 1)).toEqual(['sameColour'])
  })

  it('goes by the colours alone for a card the model has not looked at', () => {
    expect(similarCards(colours, looks, 'common', 2)).toEqual(['query', 'sameColour'])
    expect(similarCards(colours, undefined, 'query', 1)).toEqual(['sameColour'])
  })

  it('offers cards of the high rarities only, and has no answer for an unknown card', () => {
    expect(similarCards(colours, looks, 'query', 9)).not.toContain('common')
    expect(similarCards(colours, looks, 'sv2a-001', 3)).toBeUndefined()
  })
})

describe('cardsFitting', () => {
  // two moods: "a" cards point one way and are of colour 1, "b" cards the other way and of colour 9
  const colours = coloursOf({ a1: 1, a2: 1, a3: 1, b1: 9, b2: 9, between: 5, common: 1 }, 6)
  const looks = looksOf({ a1: [100, 0], a2: [95, 10], a3: [90, 20], b1: [0, 100], b2: [10, 95], between: [70, 70] })

  it('adds up over the cards asked with and leaves them out of the answer', () => {
    expect(cardsFitting(colours, looks, ['a1', 'a2'], 2)).toEqual(['a3', 'between'])
    expect(cardsFitting(colours, looks, ['b1'], 1)).toEqual(['b2'])
  })

  it('finds cards of both moods when asked with one of each', () => {
    expect(cardsFitting(colours, looks, ['a1', 'b1'], 4)).toEqual(['a3', 'a2', 'b2', 'between'])
  })

  it('leaves out the cards named, e.g. those in the binder already', () => {
    expect(cardsFitting(colours, looks, ['a1', 'a2'], 2, ['a3'])).toEqual(['between', 'b2'])
  })

  it('counts a card the model has not looked at by its colours, and skips cards nothing is known of', () => {
    expect(cardsFitting(colours, looks, ['common', 'sv2a-001'], 3)).toEqual(['a1', 'a2', 'a3'])
    expect(cardsFitting(colours, looks, ['sv2a-001'], 3)).toBeUndefined()
    expect(cardsFitting(colours, looks, [], 3)).toBeUndefined()
  })

  it('counts a card asked with twice only once', () => {
    // counted twice, the first mood would push the card of the other one to the end
    expect(cardsFitting(colours, looks, ['b1', 'a1', 'a1'], 4)).toEqual(['a3', 'a2', 'b2', 'between'])
  })
})
