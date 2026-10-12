import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardLang, SlotPosition } from '../../types/binder'
import { addPage, createBinder, setCard, setOwned, type ModelContext } from './binderModel'
import {
  applyDrop,
  isDragSource,
  isDropTarget,
  pocketId,
  withFallback,
  type CardDragSource,
} from './dragDrop'

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

function fromSearch(card: typeof glurak, lang: CardLang = 'de'): CardDragSource {
  return { kind: 'search', card, lang }
}

function fromPocket(position: SlotPosition, cardId: string): CardDragSource {
  return { kind: 'pocket', position, cardId, lang: 'de' }
}

beforeEach(() => {
  ctx = createTestContext()
  binder = addPage(createBinder({ name: 'Test' }, ctx), ctx)
})

describe('applyDrop', () => {
  it('places a card from the search as an owned German normal card', () => {
    const next = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 4) }, ctx)

    expect(slot(next, 0, 4)).toEqual({
      index: 4,
      cardRef: { cardId: 'sv03.5-006', lang: 'de', variant: 'normal' },
      owned: true,
    })
  })

  it('keeps the language the card was found in', () => {
    const charizard = { id: 'sv03.5-006', localId: '006', name: 'Charizard ex' }

    const next = applyDrop(binder, fromSearch(charizard, 'en'), { kind: 'pocket', position: at(0, 0) }, ctx)

    expect(slot(next, 0, 0)?.cardRef).toEqual({ cardId: 'sv03.5-006', lang: 'en', variant: 'normal' })
  })

  it('places the card in the finish that was looked up for it', () => {
    const holoOnly: CardDragSource = { kind: 'search', card: glurak, lang: 'de', variant: 'holo' }

    const next = applyDrop(binder, holoOnly, { kind: 'pocket', position: at(0, 0) }, ctx)

    expect(slot(next, 0, 0)?.cardRef).toEqual({ cardId: 'sv03.5-006', lang: 'de', variant: 'holo' })
  })

  it('stores only the reference, never card data', () => {
    const next = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 0) }, ctx)

    expect(JSON.stringify(next)).not.toContain('Glurak')
  })

  it('replaces the card in an occupied pocket when dropping from the search', () => {
    const filled = applyDrop(binder, fromSearch(glurak), { kind: 'pocket', position: at(0, 0) }, ctx)

    const next = applyDrop(filled, fromSearch(pikachu), { kind: 'pocket', position: at(0, 0) }, ctx)

    expect(slot(next, 0, 0)?.cardRef?.cardId).toBe('sv03.5-025')
  })

  it('moves a card from one pocket to an empty one on another page', () => {
    const filled = setCard(binder, at(0, 0), { cardId: glurak.id, lang: 'de', variant: 'normal' }, true, ctx)

    const next = applyDrop(
      filled,
      fromPocket(at(0, 0), glurak.id),
      { kind: 'pocket', position: at(1, 8) },
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
      ctx,
    )

    expect(slot(next, 0, 0)).toMatchObject({ cardRef: { cardId: 'sv03.5-025' }, owned: false })
    expect(slot(next, 0, 1)).toMatchObject({ cardRef: { cardId: 'sv03.5-006' }, owned: true })
  })

  it('leaves the binder as it is when a card is dropped on its own pocket', () => {
    const filled = setCard(binder, at(0, 0), { cardId: glurak.id, lang: 'de', variant: 'normal' }, true, ctx)

    expect(
      applyDrop(filled, fromPocket(at(0, 0), glurak.id), { kind: 'pocket', position: at(0, 0) }, ctx),
    ).toBe(filled)
  })
})

describe('withFallback', () => {
  it('passes on what the lookup finds', async () => {
    expect(await withFallback(Promise.resolve('holo'), 'normal', 1000)).toBe('holo')
  })

  it('uses the fallback when the lookup finds nothing or fails', async () => {
    expect(await withFallback(Promise.resolve(undefined), 'normal', 1000)).toBe('normal')
    expect(await withFallback(Promise.reject(new Error('offline')), 'normal', 1000)).toBe('normal')
  })

  it('does not wait longer than allowed', async () => {
    const never = new Promise<string | undefined>(() => undefined)
    const started = Date.now()

    expect(await withFallback(never, 'normal', 20)).toBe('normal')
    expect(Date.now() - started).toBeLessThan(500)
  })
})

describe('drag data', () => {
  it('recognises sources and targets', () => {
    expect(isDragSource(fromSearch(glurak))).toBe(true)
    expect(isDragSource(fromPocket(at(0, 0), glurak.id))).toBe(true)
    expect(isDragSource({ kind: 'asset', assetId: 'a' })).toBe(true)
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
