import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardRef, CardVariant } from '../../types/binder'
import {
  addPage,
  changeLayout,
  cardLangs,
  countCards,
  countProgress,
  createBinder,
  renameBinder,
  setCard,
  setCardLang,
  setVariant,
  sortCards,
  type ModelContext,
  type PlacedCard,
} from './binderModel'
import { createCardComparator, createDexComparator } from './sorting'

/** Release order: Darkness Ablaze, a set whose id contains a dash, then 151. */
const setOrder = ['swsh3', '30th-c', 'sv03.5']
const compare = createCardComparator(setOrder)

function ref(cardId: string, variant: CardVariant = 'normal'): CardRef {
  return { cardId, lang: 'de', variant }
}

function placed(cardId: string, variant: CardVariant = 'normal'): PlacedCard {
  return { cardRef: ref(cardId, variant), owned: true }
}

function sortedBy(order: (a: PlacedCard, b: PlacedCard) => number, cards: PlacedCard[]): string[] {
  return [...cards].sort(order).map((card) => `${card.cardRef.cardId}/${card.cardRef.variant}`)
}

function sortedIds(cards: PlacedCard[]): string[] {
  return sortedBy(compare, cards)
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

describe('createDexComparator', () => {
  const dexNumbers: Record<string, number> = {
    'sv03.5-001': 1,
    'sv03.5-006': 6,
    'sv03.5-025': 25,
    'swsh3-020': 6, // a Glurak from an older set
    'sv03.5-173': 25, // Pikachu again, as illustration rare
  }
  const byDex = createDexComparator((card) => dexNumbers[card.cardRef.cardId], compare)

  it('orders by Pokédex number across sets', () => {
    const cards = [placed('sv03.5-025'), placed('sv03.5-001'), placed('swsh3-020'), placed('sv03.5-006')]

    expect([...cards].sort(byDex).map((card) => card.cardRef.cardId)).toEqual([
      'sv03.5-001',
      'swsh3-020',
      'sv03.5-006',
      'sv03.5-025',
    ])
  })

  it('keeps cards of the same Pokémon together, by set, number and finish', () => {
    const cards = [
      placed('sv03.5-173'),
      placed('sv03.5-025', 'reverse'),
      placed('sv03.5-006'),
      placed('sv03.5-025'),
    ]

    expect(sortedBy(byDex, cards)).toEqual([
      'sv03.5-006/normal',
      'sv03.5-025/normal',
      'sv03.5-025/reverse',
      'sv03.5-173/normal',
    ])
  })

  it('puts cards without a number (trainers, energy) last, in set order', () => {
    const cards = [placed('sv03.5-200'), placed('sv03.5-025'), placed('swsh3-190'), placed('sv03.5-001')]

    expect(sortedBy(byDex, cards)).toEqual([
      'sv03.5-001/normal',
      'sv03.5-025/normal',
      'swsh3-190/normal',
      'sv03.5-200/normal',
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

  it('counts progress over pockets with a card only', () => {
    // four cards in 18 pockets, one of them (swsh3-136) missing
    expect(countProgress(binder)).toEqual({ total: 4, owned: 3, missing: 1 })
    expect(countProgress(createBinder({ name: 'Empty' }, ctx))).toEqual({ total: 0, owned: 0, missing: 0 })
  })

  it('changes the finish of a card and keeps the rest', () => {
    const position = { pageId: binder.pages[0]?.id ?? '', slotIndex: 3 }

    const next = setVariant(binder, position, 'pokeball', ctx)

    expect(next.pages[0]?.slots[3]).toEqual({
      index: 3,
      cardRef: { cardId: 'swsh3-136', lang: 'de', variant: 'pokeball' },
      owned: false,
    })
    expect(setVariant(next, position, 'pokeball', ctx)).toBe(next)
    expect(setVariant(binder, { ...position, slotIndex: 0 }, 'reverse', ctx)).toBe(binder)
  })

  it('renames the binder, and the cover with it while the cover still carries the name', () => {
    const renamed = renameBinder(binder, '  Kanto  ', ctx)

    expect(renamed).toMatchObject({ name: 'Kanto', cover: { title: 'Kanto' } })
    expect(renamed.updatedAt > binder.updatedAt).toBe(true)
    expect(renamed.pages).toBe(binder.pages)
  })

  it('leaves a cover title alone that was set on its own', () => {
    const custom = { ...binder, cover: { title: 'Meine ersten 151', assetId: 'a' } }

    expect(renameBinder(custom, 'Kanto', ctx).cover).toEqual({ title: 'Meine ersten 151', assetId: 'a' })
  })

  it('ignores an empty or unchanged name', () => {
    expect(renameBinder(binder, '   ', ctx)).toBe(binder)
    expect(renameBinder(binder, 'Test', ctx)).toBe(binder)
  })

  it('is German unless another language is chosen', () => {
    expect(binder.lang).toBe('de')
    expect(createBinder({ name: 'Kanto', lang: 'ja' }, ctx).lang).toBe('ja')
  })

  it('changes the language of a single card and keeps id, finish and owned state', () => {
    const position = { pageId: binder.pages[0]?.id ?? '', slotIndex: 3 }

    const next = setCardLang(binder, position, 'en', ctx)

    expect(next.pages[0]?.slots[3]).toEqual({
      index: 3,
      cardRef: { cardId: 'swsh3-136', lang: 'en', variant: 'normal' },
      owned: false,
    })
    expect(next.lang).toBe('de')
    expect(setCardLang(next, position, 'en', ctx)).toBe(next)
    expect(setCardLang(binder, { ...position, slotIndex: 0 }, 'en', ctx)).toBe(binder)
  })

  it('lists the languages of its cards, its own first', () => {
    const position = { pageId: binder.pages[1]?.id ?? '', slotIndex: 0 }
    const mixed = setCardLang(setCardLang(binder, position, 'ja', ctx), { ...position, slotIndex: 2 }, 'en', ctx)

    expect(cardLangs(binder)).toEqual(['de'])
    expect(cardLangs(mixed)).toEqual(['de', 'ja', 'en'])
    expect(cardLangs(createBinder({ name: 'Leer', lang: 'en' }, ctx))).toEqual(['en'])
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
