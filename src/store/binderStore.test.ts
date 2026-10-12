import { describe, expect, it } from 'vitest'
import type { Binder, CardRef } from '../types/binder'
import { createBinderStore, HISTORY_LIMIT } from './binderStore'

const pikachu: CardRef = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }

function setup() {
  const saved: Binder[] = []
  const store = createBinderStore({
    saveBinder: async (binder) => {
      saved.push(binder)
    },
  })
  return { store, saved }
}

function firstPageId(binder: Binder | null): string {
  const id = binder?.pages[0]?.id
  if (!id) throw new Error('Binder has no page')
  return id
}

describe('binderStore', () => {
  it('starts without a binder', () => {
    const { store } = setup()

    expect(store.getState()).toMatchObject({ binder: null, saveStatus: 'idle' })
  })

  it('creates a binder and saves it', async () => {
    const { store, saved } = setup()

    store.getState().createBinder({ name: 'Kanto Collection', layout: '2x2' })
    expect(store.getState().saveStatus).toBe('saving')
    await store.getState().whenSaved()

    expect(store.getState().binder).toMatchObject({ name: 'Kanto Collection', layout: '2x2' })
    expect(store.getState().saveStatus).toBe('saved')
    expect(saved).toEqual([store.getState().binder])
  })

  it('applies edits and saves the latest state', async () => {
    const { store, saved } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    const pageId = firstPageId(store.getState().binder)

    store.getState().addPage()
    store.getState().setCard({ pageId, slotIndex: 0 }, pikachu)
    store.getState().moveCard({ pageId, slotIndex: 0 }, { pageId, slotIndex: 4 })
    store.getState().setOwned({ pageId, slotIndex: 4 }, false)
    store.getState().setOpeningSide(pageId, 'left')
    await store.getState().whenSaved()

    const binder = store.getState().binder
    expect(binder?.pages).toHaveLength(2)
    expect(binder?.pages[0]?.openingSide).toBe('left')
    expect(binder?.pages[0]?.slots[4]).toEqual({ index: 4, cardRef: pikachu, owned: false })
    expect(saved.at(-1)).toBe(binder)
    expect(store.getState().saveStatus).toBe('saved')
  })

  it('removes pages and clears pockets', async () => {
    const { store } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    const pageId = firstPageId(store.getState().binder)
    store.getState().addPage()
    store.getState().setCard({ pageId, slotIndex: 0 }, pikachu)

    store.getState().clearSlot({ pageId, slotIndex: 0 })
    expect(store.getState().binder?.pages[0]?.slots[0]).toEqual({ index: 0, owned: false })

    store.getState().removePage(pageId)
    expect(store.getState().binder?.pages).toHaveLength(1)
    await store.getState().whenSaved()
  })

  it('drops cards from the search and between pockets', async () => {
    const { store, saved } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    const pageId = firstPageId(store.getState().binder)
    const card = { id: 'sv03.5-006', localId: '006', name: 'Glurak-ex' }

    store.getState().dropCard(
      { kind: 'search', card, lang: 'de' },
      { kind: 'pocket', position: { pageId, slotIndex: 0 } },
    )
    store.getState().dropCard(
      { kind: 'pocket', position: { pageId, slotIndex: 0 }, cardId: card.id, lang: 'de' },
      { kind: 'pocket', position: { pageId, slotIndex: 8 } },
    )
    await store.getState().whenSaved()

    const slots = store.getState().binder?.pages[0]?.slots
    expect(slots?.[0]?.cardRef).toBeUndefined()
    expect(slots?.[8]).toEqual({
      index: 8,
      cardRef: { cardId: 'sv03.5-006', lang: 'de', variant: 'normal' },
      owned: true,
    })
    expect(saved.at(-1)).toBe(store.getState().binder)
  })

  it('sorts cards and changes the layout', async () => {
    const { store } = setup()
    store.getState().createBinder({ name: 'Kanto Collection', layout: '2x2' })
    const pageId = firstPageId(store.getState().binder)
    store.getState().setCard({ pageId, slotIndex: 3 }, { cardId: 'sv03.5-001', lang: 'de', variant: 'normal' })
    store.getState().setCard({ pageId, slotIndex: 1 }, pikachu)

    store.getState().sortCards({}, ['sv03.5'])
    expect(store.getState().binder?.pages[0]?.slots.map((slot) => slot.cardRef?.cardId)).toEqual([
      'sv03.5-001',
      'sv03.5-025',
      undefined,
      undefined,
    ])

    store.getState().changeLayout('3x3')
    expect(store.getState().binder).toMatchObject({ layout: '3x3' })
    expect(store.getState().binder?.pages[0]?.slots).toHaveLength(9)
    await store.getState().whenSaved()
  })

  it('places, resizes, crops and removes images, and reports what does not fit', async () => {
    const { store, saved } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    const pageId = firstPageId(store.getState().binder)

    expect(store.getState().placeImage(pageId, 'forest', { fromSlot: 0, spanCols: 2, spanRows: 1 })).toBeNull()
    const imageId = store.getState().binder?.pages[0]?.images[0]?.id ?? ''
    await store.getState().whenSaved()
    const savedBefore = saved.length

    // refused changes leave the binder untouched and are not saved
    expect(store.getState().placeImage(pageId, 'other', { fromSlot: 1, spanCols: 1, spanRows: 1 })).toBe('overlap')
    expect(store.getState().changePlacement(pageId, imageId, { fromSlot: 0, spanCols: 4, spanRows: 1 })).toBe(
      'outOfBounds',
    )
    expect(
      store.getState().dropCard(
        { kind: 'asset', assetId: 'other' },
        { kind: 'pocket', position: { pageId, slotIndex: 0 } },
      ),
    ).toBe('overlap')
    await store.getState().whenSaved()
    expect(saved).toHaveLength(savedBefore)

    expect(
      store.getState().dropCard(
        { kind: 'asset', assetId: 'other' },
        { kind: 'pocket', position: { pageId, slotIndex: 8 } },
      ),
    ).toBeNull()
    expect(store.getState().changePlacement(pageId, imageId, { fromSlot: 0, spanCols: 3, spanRows: 2 })).toBeNull()
    store.getState().setImageCrop(pageId, imageId, { x: 0.1, y: 0.9, zoom: 2 })
    expect(store.getState().binder?.pages[0]?.images).toMatchObject([
      { assetId: 'forest', spanCols: 3, spanRows: 2, crop: { x: 0.1, y: 0.9, zoom: 2 } },
      { assetId: 'other', fromSlot: 8, spanCols: 1, spanRows: 1 },
    ])

    store.getState().removeImage(pageId, imageId)
    expect(store.getState().binder?.pages[0]?.images.map((image) => image.assetId)).toEqual(['other'])

    store.getState().setCover({ title: 'Meine 151', assetId: 'forest' })
    expect(store.getState().binder?.cover).toEqual({ title: 'Meine 151', assetId: 'forest' })
    await store.getState().whenSaved()
    expect(saved.at(-1)).toBe(store.getState().binder)
  })

  it('cuts images across two pages back when a page is removed', async () => {
    const { store } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    store.getState().addPage()
    store.getState().addPage()
    const [first, second] = store.getState().binder?.pages ?? []
    if (!first || !second) throw new Error('Expected pages')
    expect(store.getState().placeImage(second.id, 'wide', { fromSlot: 0, spanCols: 6, spanRows: 1 })).toBeNull()

    // page 2 becomes page 1, which lies alone next to the cover
    store.getState().removePage(first.id)

    expect(store.getState().binder?.pages[0]?.images).toMatchObject([{ assetId: 'wide', spanCols: 3 }])
    await store.getState().whenSaved()
  })

  describe('undo and redo', () => {
    function withCard() {
      const context = setup()
      context.store.getState().createBinder({ name: 'Kanto Collection' })
      const pageId = firstPageId(context.store.getState().binder)
      const cardIds = () =>
        context.store.getState().binder?.pages[0]?.slots.map((slot) => slot.cardRef?.cardId ?? null).slice(0, 3)
      return { ...context, pageId, cardIds }
    }

    it('has nothing to take back in a fresh binder', () => {
      const { store } = withCard()

      expect(store.getState()).toMatchObject({ canUndo: false, canRedo: false })
      store.getState().undo()
      store.getState().redo()
      expect(store.getState().binder?.pages).toHaveLength(1)
    })

    it('takes changes back step by step and brings them back again', async () => {
      const { store, saved, pageId, cardIds } = withCard()
      store.getState().setCard({ pageId, slotIndex: 0 }, pikachu)
      store.getState().moveCard({ pageId, slotIndex: 0 }, { pageId, slotIndex: 2 })
      store.getState().addPage()
      expect(store.getState()).toMatchObject({ canUndo: true, canRedo: false })

      store.getState().undo() // the page
      expect(store.getState().binder?.pages).toHaveLength(1)
      expect(cardIds()).toEqual([null, null, 'sv03.5-025'])
      store.getState().undo() // the move
      expect(cardIds()).toEqual(['sv03.5-025', null, null])
      expect(store.getState()).toMatchObject({ canUndo: true, canRedo: true })
      store.getState().undo() // the card
      expect(cardIds()).toEqual([null, null, null])
      expect(store.getState()).toMatchObject({ canUndo: false, canRedo: true })

      store.getState().redo()
      store.getState().redo()
      expect(cardIds()).toEqual([null, null, 'sv03.5-025'])
      store.getState().redo()
      expect(store.getState().binder?.pages).toHaveLength(2)
      expect(store.getState()).toMatchObject({ canUndo: true, canRedo: false })

      // what is on screen is also what is stored
      await store.getState().whenSaved()
      expect(saved.at(-1)).toBe(store.getState().binder)
    })

    it('discards what was undone as soon as something new is done', () => {
      const { store, pageId, cardIds } = withCard()
      store.getState().setCard({ pageId, slotIndex: 0 }, pikachu)
      store.getState().undo()

      store.getState().setCard({ pageId, slotIndex: 1 }, pikachu)

      expect(store.getState().canRedo).toBe(false)
      store.getState().redo()
      expect(cardIds()).toEqual([null, 'sv03.5-025', null])
    })

    it('covers owned state, variant, language, images, cover, sorting and layout', () => {
      const { store, pageId } = withCard()
      const position = { pageId, slotIndex: 0 }
      const steps: (() => void)[] = [
        () => store.getState().setCard(position, pikachu),
        () => store.getState().setOwned(position, false),
        () => store.getState().setVariant(position, 'reverse'),
        () => store.getState().setCardLang(position, 'en'),
        () => void store.getState().placeImage(pageId, 'forest', { fromSlot: 3, spanCols: 2, spanRows: 1 }),
        () => store.getState().setCover({ title: 'Meine 151' }),
        () => store.getState().setOpeningSide(pageId, 'mixed'),
        () => store.getState().moveCard(position, { pageId, slotIndex: 8 }),
        () => store.getState().sortCards({}, ['sv03.5']),
        () => store.getState().changeLayout('4x4'),
        () => store.getState().clearSlot(position),
      ]
      const states = [store.getState().binder]
      for (const step of steps) {
        step()
        states.push(store.getState().binder)
      }
      // every step really changed something
      expect(new Set(states).size).toBe(steps.length + 1)

      for (let i = steps.length - 1; i >= 0; i--) {
        store.getState().undo()
        expect(store.getState().binder).toBe(states[i])
      }
      for (let i = 1; i <= steps.length; i++) {
        store.getState().redo()
        expect(store.getState().binder).toBe(states[i])
      }
    })

    it('does not remember changes that were refused or changed nothing', () => {
      const { store, pageId } = withCard()
      store.getState().placeImage(pageId, 'forest', { fromSlot: 0, spanCols: 1, spanRows: 1 })
      const binder = store.getState().binder

      store.getState().placeImage(pageId, 'other', { fromSlot: 0, spanCols: 1, spanRows: 1 }) // overlap
      store.getState().setOwned({ pageId, slotIndex: 5 }, true) // empty pocket
      store.getState().undo()

      expect(store.getState().binder).not.toBe(binder)
      expect(store.getState().binder?.pages[0]?.images).toEqual([])
      expect(store.getState().canUndo).toBe(false)
    })

    it('keeps at most a hundred steps', () => {
      const { store, pageId } = withCard()
      for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
        store.getState().setOwned({ pageId, slotIndex: 0 }, true)
        store.getState().setCard({ pageId, slotIndex: 0 }, { ...pikachu, cardId: `sv03.5-${i}` })
      }

      let undone = 0
      while (store.getState().canUndo) {
        store.getState().undo()
        undone++
      }

      expect(undone).toBe(HISTORY_LIMIT)
      expect(store.getState().binder?.pages[0]?.slots[0]?.cardRef?.cardId).toBe('sv03.5-19')
    })

    it('starts afresh for another binder', () => {
      const { store, pageId } = withCard()
      store.getState().setCard({ pageId, slotIndex: 0 }, pikachu)
      const binder = store.getState().binder
      if (!binder) throw new Error('Binder missing')

      store.getState().closeBinder()
      expect(store.getState()).toMatchObject({ canUndo: false, canRedo: false })
      store.getState().openBinder(binder)
      store.getState().undo()

      expect(store.getState().binder).toBe(binder)
      expect(store.getState()).toMatchObject({ canUndo: false, canRedo: false })
    })
  })

  it('does not save when nothing changed', async () => {
    const { store, saved } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    await store.getState().whenSaved()
    const pageId = firstPageId(store.getState().binder)

    store.getState().setOwned({ pageId, slotIndex: 0 }, true)
    await store.getState().whenSaved()

    expect(saved).toHaveLength(1)
  })

  it('opens a stored binder without writing it again', async () => {
    const { store, saved } = setup()
    store.getState().createBinder({ name: 'Kanto Collection' })
    await store.getState().whenSaved()
    const binder = store.getState().binder
    if (!binder) throw new Error('Binder missing')
    const other = setup()

    other.store.getState().openBinder(binder)
    await other.store.getState().whenSaved()

    expect(other.store.getState()).toMatchObject({ binder, saveStatus: 'saved' })
    expect(other.saved).toEqual([])
    expect(saved).toHaveLength(1)
  })

  it('ignores edits while no binder is open', async () => {
    const { store, saved } = setup()

    store.getState().addPage()
    await store.getState().whenSaved()

    expect(store.getState().binder).toBeNull()
    expect(saved).toEqual([])
  })

  it('reports a failed save and recovers with the next change', async () => {
    let fail = true
    const saved: Binder[] = []
    const store = createBinderStore({
      saveBinder: async (binder) => {
        if (fail) throw new Error('disk full')
        saved.push(binder)
      },
    })

    store.getState().createBinder({ name: 'Kanto Collection' })
    await store.getState().whenSaved()
    expect(store.getState().saveStatus).toBe('error')

    fail = false
    store.getState().addPage()
    await store.getState().whenSaved()

    expect(store.getState().saveStatus).toBe('saved')
    expect(saved).toEqual([store.getState().binder])
  })
})
