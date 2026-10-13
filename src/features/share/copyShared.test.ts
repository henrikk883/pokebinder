import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { CardRef } from '../../types/binder'
import { addPage, countProgress, createBinder, setCard, setCount, setOwned, toTray } from '../binder/binderModel'
import { placeImage, setCover } from '../images/imageModel'
import { copyOfShared } from './copyShared'

const pikachu: CardRef = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }
const mew: CardRef = { cardId: 'sv03.5-151', lang: 'en', variant: 'holo' }

// one source of ids for the binder and its copy, as in the app
const ctx = createTestContext()

function sharedBinder() {
  let binder = createBinder({ name: 'Kanto', mode: 'masterSet', setId: 'sv03.5', layout: '2x2' }, ctx)
  const at = (slotIndex: number) => ({ pageId: binder.pages[0]?.id ?? '', slotIndex })
  binder = setCard(binder, at(0), pikachu, true, ctx)
  binder = setCount(binder, at(0), 3, ctx)
  binder = setCard(binder, at(1), mew, true, ctx)
  binder = setOwned(binder, at(1), false, ctx)
  binder = addPage(binder, ctx)
  binder = setCover(binder, { title: 'Meine 151', assetId: 'cover' }, ctx)
  const placed = placeImage(binder, binder.pages[1]?.id ?? '', 'forest', { fromSlot: 0, spanCols: 2, spanRows: 1 }, ctx)
  if (!placed.ok) throw new Error('image does not fit')
  return placed.binder
}

describe('copyOfShared', () => {
  const shared = sharedBinder()
  const copy = copyOfShared(shared, ctx)

  it('keeps pages, cards, pictures, cover and what kind of binder it is', () => {
    expect(copy.name).toBe('Kanto')
    expect(copy).toMatchObject({ mode: 'masterSet', setId: 'sv03.5', layout: '2x2', lang: shared.lang })
    expect(copy.cover).toEqual({ title: 'Meine 151', assetId: 'cover' })
    expect(copy.pages).toHaveLength(2)
    expect(copy.pages[0]?.slots.map((slot) => slot.cardRef)).toEqual([pikachu, mew, undefined, undefined])
    expect(copy.pages[1]?.images).toMatchObject([{ assetId: 'forest', fromSlot: 0, spanCols: 2, spanRows: 1 }])
  })

  it('starts every card as missing, without the other collector\'s counts', () => {
    expect(countProgress(copy)).toEqual({ total: 2, owned: 0, missing: 2 })
    expect(copy.pages[0]?.slots[0]).toEqual({ index: 0, cardRef: pikachu, owned: false })
  })

  it('is a binder of its own: new ids, new dates, nothing shared with the original', () => {
    expect(copy.id).not.toBe(shared.id)
    const ids = (binder: typeof shared) => binder.pages.flatMap((page) => [page.id, ...page.images.map((image) => image.id)])
    expect(ids(copy).filter((id) => ids(shared).includes(id))).toEqual([])
    // changing the copy leaves the original as it was
    const first = copy.pages[0]?.slots[0]
    if (first?.cardRef) first.cardRef.variant = 'reverse'
    copy.cover.title = 'Anders'
    expect(shared.pages[0]?.slots[0]?.cardRef).toEqual(pikachu)
    expect(shared.cover.title).toBe('Meine 151')
    expect(shared.pages[0]?.slots[0]).toMatchObject({ owned: true, count: 3 })
  })

  it('leaves out cards that were laid aside, should a binder come with them', () => {
    const withTray = toTray(shared, [{ pageId: shared.pages[0]?.id ?? '', slotIndex: 0 }], ctx)
    expect(copyOfShared(withTray, ctx)).not.toHaveProperty('tray')
  })
})
