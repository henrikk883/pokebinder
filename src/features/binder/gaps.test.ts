import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import {
  addPage,
  canCloseGap,
  closeGap,
  createBinder,
  insertGap,
  setCard,
  setOwned,
  type ModelContext,
} from './binderModel'

let ctx: ModelContext
/** 2 × 2 binder with two pages, so that a run of cards soon crosses a page. */
let binder: Binder

const at = (pageIndex: number, slotIndex: number) => ({ pageId: binder.pages[pageIndex]?.id ?? '', slotIndex })

/** The cards of the binder in reading order, "-" for an empty pocket, "|" between pages. */
const layout = (source: Binder) =>
  source.pages.map((page) => page.slots.map((slot) => slot.cardRef?.cardId ?? '-').join(' ')).join(' | ')

function fill(cards: string): Binder {
  let filled = binder
  cards.split(' ').forEach((cardId, index) => {
    if (cardId === '-' || cardId === '|') return
    const position = at(Math.floor(index / 4), index % 4)
    filled = setCard(filled, position, { cardId, lang: 'de', variant: 'normal' }, true, ctx)
  })
  return filled
}

beforeEach(() => {
  ctx = createTestContext()
  binder = addPage(createBinder({ name: 'Test', layout: '2x2' }, ctx), ctx)
})

describe('insertGap', () => {
  it('moves the card at the pocket and those behind it one pocket on, into the next free pocket', () => {
    const cards = fill('a b c - e - - -')

    const next = insertGap(cards, at(0, 1), ctx)

    // b and c move on; e, behind a gap of its own, stays
    expect(layout(next)).toBe('a - b c | e - - -')
  })

  it('carries cards over to the next page', () => {
    const cards = fill('a b c d e - - -')

    expect(layout(insertGap(cards, at(0, 0), ctx))).toBe('- a b c | d e - -')
  })

  it('adds a page when the cards reach the end of the binder', () => {
    const cards = fill('a b c d e f g h')

    const next = insertGap(cards, at(1, 2), ctx)

    expect(next.pages).toHaveLength(3)
    expect(layout(next)).toBe('a b c d | e f - g | h - - -')
  })

  it('takes the marks of the cards along', () => {
    const cards = setOwned(fill('a b - - - - - -'), at(0, 1), false, ctx)

    const next = insertGap(cards, at(0, 0), ctx)

    expect(layout(next)).toBe('- a b - | - - - -')
    expect(next.pages[0]?.slots[2]).toMatchObject({ owned: false, cardRef: { cardId: 'b' } })
    expect(next.pages[0]?.slots[1]).toMatchObject({ owned: true, cardRef: { cardId: 'a' } })
  })

  it('changes nothing at a pocket that is empty already', () => {
    const cards = fill('a - c - - - - -')

    expect(insertGap(cards, at(0, 1), ctx)).toBe(cards)
  })
})

describe('closeGap', () => {
  it('moves the cards behind the gap one pocket back, up to the next gap', () => {
    const cards = fill('a - c d - f - -')

    const next = closeGap(cards, at(0, 1), ctx)

    // c and d move up; f, behind a gap left on purpose, stays
    expect(layout(next)).toBe('a c d - | - f - -')
  })

  it('pulls cards back across a page', () => {
    const cards = fill('a b c - e f - -')

    expect(layout(closeGap(cards, at(0, 3), ctx))).toBe('a b c e | f - - -')
  })

  it('undoes what insertGap did', () => {
    const cards = fill('a b c d e - - -')

    expect(layout(closeGap(insertGap(cards, at(0, 1), ctx), at(0, 1), ctx))).toBe(layout(cards))
  })

  it('changes nothing where there is no gap, or nothing behind it', () => {
    const cards = fill('a - - d - - - -')

    expect(closeGap(cards, at(0, 0), ctx)).toBe(cards)
    expect(closeGap(cards, at(0, 1), ctx)).toBe(cards)
    expect(closeGap(cards, at(1, 3), ctx)).toBe(cards)
  })
})

describe('canCloseGap', () => {
  it('is true only at an empty pocket with a card right behind it', () => {
    const cards = fill('a - c - - - - -')

    expect(canCloseGap(cards, at(0, 1))).toBe(true)
    expect(canCloseGap(cards, at(0, 0))).toBe(false)
    expect(canCloseGap(cards, at(0, 3))).toBe(false)
    expect(canCloseGap(cards, at(1, 3))).toBe(false)
  })
})
