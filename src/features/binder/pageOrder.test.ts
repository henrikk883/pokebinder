import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { normalizeImages, placeImage } from '../images/imageModel'
import {
  addPage,
  createBinder,
  duplicatePage,
  insertPage,
  movePage,
  setCard,
  setOpeningSide,
  type ModelContext,
} from './binderModel'

let ctx: ModelContext
/** Four pages, each with one card in its first pocket: card "p1" on page 1 and so on. */
let binder: Binder

const cardsOf = (source: Binder) => source.pages.map((page) => page.slots[0]?.cardRef?.cardId ?? '-')
const indices = (source: Binder) => source.pages.map((page) => page.index)
const idOf = (pageIndex: number) => binder.pages[pageIndex]?.id ?? ''

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
  for (let i = 0; i < 3; i++) binder = addPage(binder, ctx)
  for (const page of binder.pages) {
    binder = setCard(
      binder,
      { pageId: page.id, slotIndex: 0 },
      { cardId: `p${page.index + 1}`, lang: 'de', variant: 'normal' },
      true,
      ctx,
    )
  }
})

describe('movePage', () => {
  it('moves a page forward; the pages in between move back by one', () => {
    const moved = movePage(binder, idOf(3), 1, ctx)

    expect(cardsOf(moved)).toEqual(['p1', 'p4', 'p2', 'p3'])
    expect(indices(moved)).toEqual([0, 1, 2, 3])
  })

  it('moves a page back; the pages in between move up by one', () => {
    expect(cardsOf(movePage(binder, idOf(0), 2, ctx))).toEqual(['p2', 'p3', 'p1', 'p4'])
    expect(cardsOf(movePage(binder, idOf(1), 3, ctx))).toEqual(['p1', 'p3', 'p4', 'p2'])
  })

  it('keeps the pages themselves: ids, cards, opening side', () => {
    const withSide = setOpeningSide(binder, idOf(3), 'left', ctx)

    const moved = movePage(withSide, idOf(3), 0, ctx)

    expect(moved.pages[0]).toMatchObject({ id: idOf(3), index: 0, openingSide: 'left' })
    expect(moved.pages.map((page) => page.id).sort()).toEqual(binder.pages.map((page) => page.id).sort())
  })

  it('stops at the ends and changes nothing when the page stays where it is', () => {
    expect(cardsOf(movePage(binder, idOf(1), 99, ctx))).toEqual(['p1', 'p3', 'p4', 'p2'])
    expect(cardsOf(movePage(binder, idOf(1), -5, ctx))).toEqual(['p2', 'p1', 'p3', 'p4'])
    expect(movePage(binder, idOf(2), 2, ctx)).toBe(binder)
    expect(() => movePage(binder, 'nope', 0, ctx)).toThrow(RangeError)
  })

  it('leaves an image across the rings on its own page when the pages part', () => {
    // pages 2 and 3 face each other; the image reaches from page 2 onto page 3
    const placed = placeImage(binder, idOf(1), 'asset', { fromSlot: 2, spanCols: 2, spanRows: 1 }, ctx)
    if (!placed.ok) throw new Error('Placement refused')

    // page 2 moves to the front, where nothing faces it
    const moved = normalizeImages(movePage(placed.binder, idOf(1), 0, ctx), ctx)

    expect(moved.pages[0]?.images).toMatchObject([{ fromSlot: 2, spanCols: 1, spanRows: 1 }])
  })
})

describe('insertPage', () => {
  it('adds an empty page in the middle of the binder', () => {
    const inserted = insertPage(binder, 1, ctx)

    expect(cardsOf(inserted)).toEqual(['p1', '-', 'p2', 'p3', 'p4'])
    expect(indices(inserted)).toEqual([0, 1, 2, 3, 4])
    expect(inserted.pages[1]?.slots).toHaveLength(9)
    expect(inserted.pages[1]?.openingSide).toBe(binder.defaultOpeningSide)
  })

  it('adds at the front and at the end', () => {
    expect(cardsOf(insertPage(binder, 0, ctx))).toEqual(['-', 'p1', 'p2', 'p3', 'p4'])
    expect(cardsOf(insertPage(binder, 4, ctx))).toEqual(['p1', 'p2', 'p3', 'p4', '-'])
    expect(cardsOf(insertPage(binder, 99, ctx))).toEqual(['p1', 'p2', 'p3', 'p4', '-'])
  })
})

describe('duplicatePage', () => {
  it('puts a copy with the same cards, marks and opening side right behind the page', () => {
    let source = setOpeningSide(binder, idOf(1), 'mixed', ctx)
    source = setCard(
      source,
      { pageId: idOf(1), slotIndex: 4 },
      { cardId: 'missing', lang: 'en', variant: 'reverse' },
      false,
      ctx,
    )

    const copied = duplicatePage(source, idOf(1), ctx)

    expect(cardsOf(copied)).toEqual(['p1', 'p2', 'p2', 'p3', 'p4'])
    expect(indices(copied)).toEqual([0, 1, 2, 3, 4])
    const [original, copy] = [copied.pages[1], copied.pages[2]]
    expect(copy?.id).not.toBe(original?.id)
    expect(copy?.openingSide).toBe('mixed')
    expect(copy?.slots).toEqual(original?.slots)
    expect(copy?.slots[4]).toMatchObject({
      owned: false,
      cardRef: { cardId: 'missing', lang: 'en', variant: 'reverse' },
    })
  })

  it('copies the images of the page, each under an id of its own', () => {
    const placed = placeImage(binder, idOf(0), 'asset', { fromSlot: 3, spanCols: 2, spanRows: 2 }, ctx)
    if (!placed.ok) throw new Error('Placement refused')

    const copied = duplicatePage(placed.binder, idOf(0), ctx)

    const [original] = copied.pages[0]?.images ?? []
    const [copy] = copied.pages[1]?.images ?? []
    expect(copy).toMatchObject({ assetId: 'asset', fromSlot: 3, spanCols: 2, spanRows: 2 })
    expect(copy?.id).not.toBe(original?.id)
  })

  it('does not tie the copy to the original', () => {
    const copied = duplicatePage(binder, idOf(0), ctx)
    const changed = setCard(
      copied,
      { pageId: copied.pages[1]?.id ?? '', slotIndex: 0 },
      { cardId: 'other', lang: 'de', variant: 'normal' },
      true,
      ctx,
    )

    expect(cardsOf(changed)).toEqual(['p1', 'other', 'p2', 'p3', 'p4'])
  })
})
