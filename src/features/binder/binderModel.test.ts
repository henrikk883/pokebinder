import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardRef, SlotPosition } from '../../types/binder'
import {
  addPage,
  clearSlot,
  createBinder,
  moveCard,
  pocketOpening,
  removePage,
  setCard,
  setOpeningSide,
  setOwned,
  layoutDimensions,
  slotsPerPage,
  type ModelContext,
} from './binderModel'

const pikachu: CardRef = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }
const mew: CardRef = { cardId: 'sv03.5-151', lang: 'de', variant: 'holo' }

let ctx: ModelContext
let binder: Binder

function at(source: Binder, pageIndex: number, slotIndex: number): SlotPosition {
  const page = source.pages[pageIndex]
  if (!page) throw new Error(`No page ${pageIndex}`)
  return { pageId: page.id, slotIndex }
}

function slot(source: Binder, pageIndex: number, slotIndex: number) {
  return source.pages[pageIndex]?.slots[slotIndex]
}

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Kanto Collection' }, ctx)
})

describe('createBinder', () => {
  it('creates an empty 3x3 binder with one page and the documented defaults', () => {
    expect(binder).toMatchObject({
      name: 'Kanto Collection',
      mode: 'empty',
      layout: '3x3',
      defaultOpeningSide: 'right',
      withReverseHolo: false,
      withSecretRares: true,
      withPromos: true,
      cover: { title: 'Kanto Collection' },
    })
    expect(binder.createdAt).toBe(binder.updatedAt)
    expect(binder.pages).toHaveLength(1)
    expect(binder.pages[0]?.openingSide).toBe('right')
    expect(binder.pages[0]?.images).toEqual([])
    expect(binder).not.toHaveProperty('setId')
  })

  it('reads a layout as columns × rows', () => {
    expect(layoutDimensions('3x4')).toEqual({ rows: 4, cols: 3 })
    expect(layoutDimensions('5x4')).toEqual({ rows: 4, cols: 5 })
  })

  it.each([
    ['2x2', 4],
    ['3x3', 9],
    ['3x4', 12],
    ['4x4', 16],
    ['5x4', 20],
  ] as const)('gives a %s page %i empty, consecutively numbered pockets', (layout, count) => {
    const created = createBinder({ name: 'Test', layout }, ctx)
    const slots = created.pages[0]?.slots ?? []

    expect(slotsPerPage(layout)).toBe(count)
    expect(slots.map((s) => s.index)).toEqual(Array.from({ length: count }, (_, i) => i))
    expect(slots.every((s) => s.cardRef === undefined && !s.owned)).toBe(true)
  })

  it('keeps the master set options', () => {
    const created = createBinder(
      {
        name: '151',
        mode: 'masterSet',
        setId: 'sv03.5',
        withReverseHolo: true,
        withPromos: false,
        defaultOpeningSide: 'left',
      },
      ctx,
    )

    expect(created).toMatchObject({
      mode: 'masterSet',
      setId: 'sv03.5',
      withReverseHolo: true,
      withSecretRares: true,
      withPromos: false,
      defaultOpeningSide: 'left',
    })
    expect(created.pages[0]?.openingSide).toBe('left')
  })
})

describe('pages', () => {
  it('appends a page with the binder layout and default opening side', () => {
    const next = addPage(binder, ctx)

    expect(next.pages).toHaveLength(2)
    expect(next.pages[1]).toMatchObject({ index: 1, openingSide: 'right', images: [] })
    expect(next.pages[1]?.slots).toHaveLength(9)
    expect(next.pages[1]?.id).not.toBe(next.pages[0]?.id)
    expect(next.updatedAt > binder.updatedAt).toBe(true)
    expect(binder.pages).toHaveLength(1)
  })

  it('removes a page and renumbers the rest', () => {
    const three = addPage(addPage(binder, ctx), ctx)
    const [first, second, third] = three.pages

    const next = removePage(three, second?.id ?? '', ctx)

    expect(next.pages.map((p) => p.id)).toEqual([first?.id, third?.id])
    expect(next.pages.map((p) => p.index)).toEqual([0, 1])
  })

  it('changes the opening side of one page only', () => {
    const two = addPage(binder, ctx)

    const next = setOpeningSide(two, two.pages[1]?.id ?? '', 'left', ctx)

    expect(next.pages.map((p) => p.openingSide)).toEqual(['right', 'left'])
  })

  it('rejects unknown pages', () => {
    expect(() => removePage(binder, 'nope', ctx)).toThrow(RangeError)
    expect(() => setOpeningSide(binder, 'nope', 'left', ctx)).toThrow(RangeError)
  })
})

describe('pocketOpening', () => {
  const row = (side: 'left' | 'right' | 'mixed', pageIndex: number, layout: '2x2' | '3x3' | '4x4') => {
    const cols = Number(layout[0])
    return Array.from({ length: cols * cols }, (_, slot) => pocketOpening(side, pageIndex, slot, layout))
  }

  it('opens every pocket to the same side for left and right', () => {
    expect(new Set(row('left', 0, '3x3'))).toEqual(new Set(['left']))
    expect(new Set(row('right', 1, '3x3'))).toEqual(new Set(['right']))
  })

  it('mixed on odd pages (right-hand side): right, right, left in every row', () => {
    const pattern = ['right', 'right', 'left']
    expect(row('mixed', 0, '3x3')).toEqual([...pattern, ...pattern, ...pattern])
    expect(row('mixed', 2, '3x3')).toEqual(row('mixed', 0, '3x3'))
  })

  it('mixed on even pages (left-hand side): right, left, left in every row', () => {
    const pattern = ['right', 'left', 'left']
    expect(row('mixed', 1, '3x3')).toEqual([...pattern, ...pattern, ...pattern])
    expect(row('mixed', 3, '3x3')).toEqual(row('mixed', 1, '3x3'))
  })

  it('mixed keeps the idea for other layouts: only the outer column opens towards the rings', () => {
    expect(row('mixed', 0, '2x2').slice(0, 2)).toEqual(['right', 'left'])
    expect(row('mixed', 1, '2x2').slice(0, 2)).toEqual(['right', 'left'])
    expect(row('mixed', 0, '4x4').slice(0, 4)).toEqual(['right', 'right', 'right', 'left'])
    expect(row('mixed', 1, '4x4').slice(0, 4)).toEqual(['right', 'left', 'left', 'left'])
  })
})

describe('cards', () => {
  it('puts a card into a pocket as owned and leaves the original untouched', () => {
    const next = setCard(binder, at(binder, 0, 4), pikachu, undefined, ctx)

    expect(slot(next, 0, 4)).toEqual({ index: 4, cardRef: pikachu, owned: true })
    expect(slot(binder, 0, 4)).toEqual({ index: 4, owned: false })
    expect(next.updatedAt > binder.updatedAt).toBe(true)
  })

  it('can place a card as missing', () => {
    const next = setCard(binder, at(binder, 0, 0), pikachu, false, ctx)

    expect(slot(next, 0, 0)).toEqual({ index: 0, cardRef: pikachu, owned: false })
  })

  it('clears a pocket', () => {
    const filled = setCard(binder, at(binder, 0, 2), pikachu, true, ctx)

    const next = clearSlot(filled, at(filled, 0, 2), ctx)

    expect(slot(next, 0, 2)).toEqual({ index: 2, owned: false })
  })

  it('moves a card into an empty pocket on another page', () => {
    const filled = setCard(addPage(binder, ctx), at(binder, 0, 0), pikachu, false, ctx)

    const next = moveCard(filled, at(filled, 0, 0), at(filled, 1, 8), ctx)

    expect(slot(next, 0, 0)).toEqual({ index: 0, owned: false })
    expect(slot(next, 1, 8)).toEqual({ index: 8, cardRef: pikachu, owned: false })
  })

  it('swaps cards when the target pocket is occupied', () => {
    let filled = setCard(binder, at(binder, 0, 0), pikachu, true, ctx)
    filled = setCard(filled, at(filled, 0, 1), mew, false, ctx)

    const next = moveCard(filled, at(filled, 0, 0), at(filled, 0, 1), ctx)

    expect(slot(next, 0, 0)).toEqual({ index: 0, cardRef: mew, owned: false })
    expect(slot(next, 0, 1)).toEqual({ index: 1, cardRef: pikachu, owned: true })
  })

  it('does nothing when moving from an empty pocket or onto itself', () => {
    const filled = setCard(binder, at(binder, 0, 0), pikachu, true, ctx)

    expect(moveCard(filled, at(filled, 0, 5), at(filled, 0, 0), ctx)).toBe(filled)
    expect(moveCard(filled, at(filled, 0, 0), at(filled, 0, 0), ctx)).toBe(filled)
  })

  it('toggles owned for cards and ignores empty pockets', () => {
    const filled = setCard(binder, at(binder, 0, 0), pikachu, true, ctx)

    const missing = setOwned(filled, at(filled, 0, 0), false, ctx)

    expect(slot(missing, 0, 0)).toEqual({ index: 0, cardRef: pikachu, owned: false })
    expect(setOwned(filled, at(filled, 0, 1), true, ctx)).toBe(filled)
    expect(setOwned(filled, at(filled, 0, 0), true, ctx)).toBe(filled)
  })

  it('rejects pockets that do not exist', () => {
    expect(() => setCard(binder, at(binder, 0, 9), pikachu, true, ctx)).toThrow(RangeError)
    expect(() => clearSlot(binder, { pageId: 'nope', slotIndex: 0 }, ctx)).toThrow(RangeError)
  })
})
