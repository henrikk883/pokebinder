import { describe, expect, it } from 'vitest'
import type { Binder, CardRef } from '../types/binder'
import { createBinderStore } from './binderStore'

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

    store.getState().dropCard({ kind: 'search', card }, { kind: 'pocket', position: { pageId, slotIndex: 0 } })
    store.getState().dropCard(
      { kind: 'pocket', position: { pageId, slotIndex: 0 }, cardId: card.id },
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
