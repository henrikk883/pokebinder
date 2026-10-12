import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import {
  addPage,
  clearSlots,
  createBinder,
  moveCards,
  pocketsBetween,
  setCard,
  setCount,
  setOwned,
  setOwnedMany,
  type ModelContext,
} from './binderModel'

let ctx: ModelContext
/** 2 × 2 binder with two pages. */
let binder: Binder

const at = (index: number) => ({ pageId: binder.pages[Math.floor(index / 4)]?.id ?? '', slotIndex: index % 4 })

/** The cards of the binder in reading order, "-" for an empty pocket, "|" between pages. */
const layout = (source: Binder) =>
  source.pages.map((page) => page.slots.map((slot) => slot.cardRef?.cardId ?? '-').join(' ')).join(' | ')

function fill(cards: string): Binder {
  let filled = binder
  cards
    .split(' ')
    .filter((entry) => entry !== '|')
    .forEach((cardId, index) => {
      if (cardId === '-') return
      filled = setCard(filled, at(index), { cardId, lang: 'de', variant: 'normal' }, true, ctx)
    })
  return filled
}

beforeEach(() => {
  ctx = createTestContext()
  binder = addPage(createBinder({ name: 'Test', layout: '2x2' }, ctx), ctx)
})

describe('pocketsBetween', () => {
  it('names every pocket from one to the other, across pages, in either direction', () => {
    expect(pocketsBetween(binder, at(2), at(5))).toEqual([at(2), at(3), at(4), at(5)])
    expect(pocketsBetween(binder, at(5), at(2))).toEqual([at(2), at(3), at(4), at(5)])
    expect(pocketsBetween(binder, at(1), at(1))).toEqual([at(1)])
  })
})

describe('moveCards', () => {
  it('moves the cards together by the way one of them is dragged', () => {
    const cards = fill('a b - - | - - - -')

    // "a" dragged from pocket 1 to pocket 3: both go two pockets on
    const result = moveCards(cards, [at(0), at(1)], at(0), at(2), ctx)

    expect(layout(result?.binder ?? binder)).toBe('- - a b | - - - -')
    expect(result?.moved).toEqual([at(2), at(3)])
  })

  it('keeps the distances between the cards, across pages too', () => {
    const cards = fill('a - c - | - - - -')

    const result = moveCards(cards, [at(2), at(0)], at(2), at(5), ctx)

    expect(layout(result?.binder ?? binder)).toBe('- - - a | - c - -')
  })

  it('puts the cards that lie in the way into the pockets that become free', () => {
    const cards = fill('a b x y | - - - -')

    const result = moveCards(cards, [at(0), at(1)], at(0), at(2), ctx)

    expect(layout(result?.binder ?? binder)).toBe('x y a b | - - - -')
  })

  it('moves by one pocket through its own places', () => {
    const cards = fill('a b c x | - - - -')

    // three cards one pocket on: only "x" is in the way, and only pocket 1 becomes free
    expect(layout(moveCards(cards, [at(0), at(1), at(2)], at(0), at(1), ctx)?.binder ?? binder)).toBe('x a b c | - - - -')
  })

  it('takes marks and numbers of copies along', () => {
    let cards = fill('a b - - | - - - -')
    cards = setOwned(cards, at(1), false, ctx)
    cards = setCount(cards, at(0), 3, ctx)

    const moved = moveCards(cards, [at(0), at(1)], at(1), at(3), ctx)?.binder

    expect(moved?.pages[0]?.slots[2]).toMatchObject({ cardRef: { cardId: 'a' }, owned: true, count: 3 })
    expect(moved?.pages[0]?.slots[3]).toMatchObject({ cardRef: { cardId: 'b' }, owned: false })
  })

  it('passes over selected pockets without a card', () => {
    const cards = fill('a - c - | - - - -')

    const result = moveCards(cards, [at(0), at(1), at(2)], at(0), at(4), ctx)

    expect(layout(result?.binder ?? binder)).toBe('- - - - | a - c -')
    expect(result?.moved).toEqual([at(4), at(6)])
  })

  it('refuses a move that would carry a card out of the binder', () => {
    const cards = fill('a b - - | - - c d')

    expect(moveCards(cards, [at(6), at(7)], at(6), at(7), ctx)).toBeNull()
    expect(moveCards(cards, [at(0), at(1)], at(1), at(0), ctx)).toBeNull()
  })

  it('changes nothing when dropped where it was', () => {
    const cards = fill('a b - - | - - - -')

    expect(moveCards(cards, [at(0), at(1)], at(1), at(1), ctx)?.binder).toBe(cards)
  })
})

describe('clearSlots and setOwnedMany', () => {
  it('empties several pockets at once', () => {
    const cards = fill('a b c - | d - - -')

    expect(layout(clearSlots(cards, [at(0), at(2), at(3), at(4)], ctx))).toBe('- b - - | - - - -')
    expect(clearSlots(cards, [at(3), at(5)], ctx)).toBe(cards)
  })

  it('marks several cards as missing or owned and passes over empty pockets', () => {
    const cards = fill('a b - - | - - - -')

    const missing = setOwnedMany(cards, [at(0), at(1), at(2)], false, ctx)
    expect(missing.pages[0]?.slots.slice(0, 3).map((slot) => slot.owned)).toEqual([false, false, false])
    expect(missing.pages[0]?.slots[2]?.cardRef).toBeUndefined()

    const back = setOwnedMany(missing, [at(0)], true, ctx)
    expect(back.pages[0]?.slots.slice(0, 2).map((slot) => slot.owned)).toEqual([true, false])
    expect(setOwnedMany(cards, [at(0), at(1)], true, ctx)).toBe(cards)
  })
})
