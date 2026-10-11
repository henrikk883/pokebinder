import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardRef, CardVariant } from '../../types/binder'
import {
  addPage,
  changeLayout,
  countCards,
  createBinder,
  setCard,
  sortCards,
  type ModelContext,
  type PlacedCard,
} from './binderModel'
import { createCardComparator } from './sorting'

/** Release order: Darkness Ablaze, a set whose id contains a dash, then 151. */
const setOrder = ['swsh3', '30th-c', 'sv03.5']
const compare = createCardComparator(setOrder)

function ref(cardId: string, variant: CardVariant = 'normal'): CardRef {
  return { cardId, lang: 'de', variant }
}

function placed(cardId: string, variant: CardVariant = 'normal'): PlacedCard {
  return { cardRef: ref(cardId, variant), owned: true }
}

function sortedIds(cards: PlacedCard[]): string[] {
  return [...cards].sort(compare).map((card) => `${card.cardRef.cardId}/${card.cardRef.variant}`)
}

describe('createCardComparator', () => {
  it('orders by set first, in release order', () => {
    expect(sortedIds([placed('sv03.5-001'), placed('swsh3-136'), placed('30th-c-001')])).toEqual([
      'swsh3-136/normal',
      '30th-c-001/normal',
      'sv03.5-001/normal',
    ])
  })

  it('orders by number inside a set, by value and not by text', () => {
    expect(sortedIds([placed('sv03.5-100'), placed('sv03.5-025'), placed('sv03.5-006')])).toEqual([
      'sv03.5-006/normal',
      'sv03.5-025/normal',
      'sv03.5-100/normal',
    ])
  })

  it('puts the variants of a card next to each other, normal first', () => {
    expect(
      sortedIds([
        placed('sv03.5-025', 'masterball'),
        placed('sv03.5-026'),
        placed('sv03.5-025', 'reverse'),
        placed('sv03.5-025'),
      ]),
    ).toEqual([
      'sv03.5-025/normal',
      'sv03.5-025/reverse',
      'sv03.5-025/masterball',
      'sv03.5-026/normal',
    ])
  })

  it('puts cards of unknown sets last', () => {
    expect(sortedIds([placed('mystery-7'), placed('sv03.5-001'), placed('mystery-2')])).toEqual([
      'sv03.5-001/normal',
      'mystery-2/normal',
      'mystery-7/normal',
    ])
  })
})

describe('binder operations', () => {
  let ctx: ModelContext
  let binder: Binder

  function cardIds(source: Binder): (string | undefined)[][] {
    return source.pages.map((page) => page.slots.map((slot) => slot.cardRef?.cardId))
  }

  beforeEach(() => {
    ctx = createTestContext()
    binder = addPage(createBinder({ name: 'Test', layout: '2x2' }, ctx), ctx)
    const [first, second] = binder.pages
    if (!first || !second) throw new Error('Expected two pages')
    binder = setCard(binder, { pageId: first.id, slotIndex: 1 }, ref('sv03.5-025'), true, ctx)
    binder = setCard(binder, { pageId: first.id, slotIndex: 3 }, ref('swsh3-136'), false, ctx)
    binder = setCard(binder, { pageId: second.id, slotIndex: 0 }, ref('sv03.5-006'), true, ctx)
    binder = setCard(binder, { pageId: second.id, slotIndex: 2 }, ref('sv03.5-001'), true, ctx)
  })

  it('sorts one page and moves its cards to the first pockets', () => {
    const next = sortCards(binder, { pageId: binder.pages[1]?.id ?? '' }, compare, ctx)

    expect(cardIds(next)).toEqual([
      [undefined, 'sv03.5-025', undefined, 'swsh3-136'],
      ['sv03.5-001', 'sv03.5-006', undefined, undefined],
    ])
  })

  it('sorts the whole binder across pages and keeps the owned state with each card', () => {
    const next = sortCards(binder, {}, compare, ctx)

    expect(cardIds(next)).toEqual([
      ['swsh3-136', 'sv03.5-001', 'sv03.5-006', 'sv03.5-025'],
      [undefined, undefined, undefined, undefined],
    ])
    expect(next.pages[0]?.slots.map((slot) => slot.owned)).toEqual([false, true, true, true])
    expect(next.pages.map((page) => page.id)).toEqual(binder.pages.map((page) => page.id))
  })

  it('rejects sorting an unknown page', () => {
    expect(() => sortCards(binder, { pageId: 'nope' }, compare, ctx)).toThrow(RangeError)
  })

  it('counts the cards in the binder', () => {
    expect(countCards(binder)).toBe(4)
    expect(countCards(createBinder({ name: 'Empty' }, ctx))).toBe(0)
  })

  it('changes to a larger layout and keeps the cards in order', () => {
    const next = changeLayout(binder, '3x3', ctx)

    expect(next.layout).toBe('3x3')
    expect(next.pages).toHaveLength(2)
    expect(next.pages.map((page) => page.slots.length)).toEqual([9, 9])
    expect(cardIds(next)[0]?.slice(0, 5)).toEqual([
      'sv03.5-025',
      'swsh3-136',
      'sv03.5-006',
      'sv03.5-001',
      undefined,
    ])
    expect(next.pages[0]?.slots[1]?.owned).toBe(false)
    expect(next.pages.map((page) => page.id)).toEqual(binder.pages.map((page) => page.id))
  })

  it('adds pages when a smaller layout needs more of them', () => {
    let full = changeLayout(binder, '4x4', ctx)
    const pageId = full.pages[0]?.id ?? ''
    for (let i = 4; i < 16; i++) {
      full = setCard(full, { pageId, slotIndex: i }, ref(`sv03.5-${100 + i}`), true, ctx)
    }

    const next = changeLayout(full, '2x2', ctx)

    expect(next.pages).toHaveLength(4)
    expect(countCards(next)).toBe(16)
    expect(next.pages.map((page) => page.index)).toEqual([0, 1, 2, 3])
    expect(new Set(next.pages.map((page) => page.id)).size).toBe(4)
  })

  it('keeps the opening side of existing pages and drops placed images', () => {
    const [first, second] = binder.pages
    if (!first || !second) throw new Error('Expected two pages')
    const prepared: Binder = {
      ...binder,
      pages: [
        first,
        {
          ...second,
          openingSide: 'left',
          images: [
            { id: 'i', assetId: 'a', fromSlot: 0, spanCols: 2, spanRows: 1, crop: { x: 0, y: 0, zoom: 1 } },
          ],
        },
      ],
    }

    const next = changeLayout(prepared, '3x3', ctx)

    expect(next.pages.map((page) => page.openingSide)).toEqual(['right', 'left'])
    expect(next.pages.map((page) => page.images)).toEqual([[], []])
  })

  it('does nothing when the layout stays the same', () => {
    expect(changeLayout(binder, '2x2', ctx)).toBe(binder)
  })
})
