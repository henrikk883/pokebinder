import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, SlotPosition } from '../../types/binder'
import { addPage, createBinder, setCard, setOwned, type ModelContext } from './binderModel'
import { applyDrop, isDragSource, isDropTarget, pocketId, type DragSource } from './dragDrop'

const glurak = { id: 'sv03.5-006', localId: '006', name: 'Glurak-ex' }
const pikachu = { id: 'sv03.5-025', localId: '025', name: 'Pikachu' }

let ctx: ModelContext
let binder: Binder

function at(pageIndex: number, slotIndex: number): SlotPosition {
  return { pageId: binder.pages[pageIndex]?.id ?? '', slotIndex }
}

function slot(source: Binder, pageIndex: number, slotIndex: number) {
  return source.pages[pageIndex]?.slots[slotIndex]
}

function fromSearch(card: typeof glurak): DragSource {
  return { kind: 'search', card }
}

function fromPocket(position: SlotPosition, cardId: string): DragSource {
  return { kind: 'pocket', position, cardId }
}

beforeEach(() => {
  ctx = createTestContext()
  binder = addPage(createBinder({ name: 'Test' }, ctx), ctx)
})

describe('applyDrop', () => {
  it('places a card from the search as an owned German normal card', () => {
    const next = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 4) }, 'de', ctx)

    expect(slot(next, 0, 4)).toEqual({
      index: 4,
      cardRef: { cardId: 'sv03.5-006', lang: 'de', variant: 'normal' },
      owned: true,
    })
  })

  it('stores only the reference, never card data', () => {
    const next = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 0) }, 'de', ctx)

    expect(JSON.stringify(next)).not.toContain('Glurak')
  })

  it('replaces the card in an occupied pocket when dropping from the search', () => {
    const filled = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 0) }, 'de', ctx)

    const next = applyDrop(filled, fromSearch(pikachu), { kind: 'pocket', position: at(0, 0) }, 'de', ctx)

    expect(slot(next, 0, 0)?.cardRef?.cardId).toBe('sv03.5-025')
  })

  it('moves a card from one pocket to an empty one on another page', () => {
    const filled = setCard(binder, at(0, 0), { cardId: glurak.id, lang: 'de', variant: 'normal' }, true, ctx)

    const next = applyDrop(
      filled,
      fromPocket(at(0, 0), glurak.id),
      { kind: 'pocket', position: at(1, 8) },
      'de',
      ctx,
    )

    expect(slot(next, 0, 0)?.cardRef).toBeUndefined()
    expect(slot(next, 1, 8)?.cardRef?.cardId).toBe('sv03.5-006')
  })

  it('swaps two cards, each keeping whether it is owned', () => {
    let filled = setCard(binder, at(0, 0), { cardId: glurak.id, lang: 'de', variant: 'normal' }, true, ctx)
    filled = setCard(filled, at(0, 1), { cardId: pikachu.id, lang: 'de', variant: 'normal' }, true, ctx)
    filled = setOwned(filled, at(0, 1), false, ctx)

    const next = applyDrop(
      filled,
      fromPocket(at(0, 0), glurak.id),
      { kind: 'pocket', position: at(0, 1) },
      'de',
      ctx,
    )

    expect(slot(next, 0, 0)).toMatchObject({ cardRef: { cardId: 'sv03.5-025' }, owned: false })
    expect(slot(next, 0, 1)).toMatchObject({ cardRef: { cardId: 'sv03.5-006' }, owned: true })
  })

  it('leaves the binder as it is when a card is dropped on its own pocket', () => {
    const filled = setCard(binder, at(0, 0), { cardId: glurak.id, lang: 'de', variant: 'normal' }, true, ctx)

    expect(
      applyDrop(filled, fromPocket(at(0, 0), glurak.id), { kind: 'pocket', position: at(0, 0) }, 'de', ctx),
    ).toBe(filled)
  })
})

describe('drag data', () => {
  it('recognises sources and targets', () => {
    expect(isDragSource(fromSearch(glurak))).toBe(true)
    expect(isDragSource(fromPocket(at(0, 0), glurak.id))).toBe(true)
    expect(isDragSource({ kind: 'other' })).toBe(false)
    expect(isDragSource(undefined)).toBe(false)

    expect(isDropTarget({ kind: 'pocket', position: at(0, 0) })).toBe(true)
    expect(isDropTarget({ kind: 'search' })).toBe(false)
    expect(isDropTarget(null)).toBe(false)
  })

  it('gives every pocket its own id', () => {
    expect(pocketId({ pageId: 'p1', slotIndex: 0 })).not.toBe(pocketId({ pageId: 'p1', slotIndex: 1 }))
    expect(pocketId({ pageId: 'p1', slotIndex: 0 })).not.toBe(pocketId({ pageId: 'p2', slotIndex: 0 }))
  })
})
