import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardRef, SlotPosition } from '../../types/binder'
import {
  addPage,
  addToTray,
  countCards,
  countedPages,
  countProgress,
  createBinder,
  fromTray,
  heldCards,
  pageToTray,
  removeFromTray,
  setCard,
  setCount,
  setOwned,
  toTray,
  TRAY_PAGE,
  trayOf,
  type ModelContext,
} from './binderModel'
import { holdingsOf } from './cardHoldings'

const pikachu: CardRef = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }
const mew: CardRef = { cardId: 'sv03.5-151', lang: 'en', variant: 'holo' }
const glurak: CardRef = { cardId: 'sv03.5-006', lang: 'de', variant: 'holo' }

let ctx: ModelContext
let binder: Binder

const at = (source: Binder, pageIndex: number, slotIndex: number): SlotPosition => ({
  pageId: source.pages[pageIndex]?.id ?? '',
  slotIndex,
})
const slot = (source: Binder, pageIndex: number, slotIndex: number) => source.pages[pageIndex]?.slots[slotIndex]

beforeEach(() => {
  ctx = createTestContext()
  // page 1: Pikachu (three copies), Mew (missing), an empty pocket, Glurak
  binder = createBinder({ name: 'Kanto' }, ctx)
  binder = setCard(binder, at(binder, 0, 0), pikachu, true, ctx)
  binder = setCount(binder, at(binder, 0, 0), 3, ctx)
  binder = setCard(binder, at(binder, 0, 1), mew, true, ctx)
  binder = setOwned(binder, at(binder, 0, 1), false, ctx)
  binder = setCard(binder, at(binder, 0, 3), glurak, true, ctx)
})

describe('laying cards aside', () => {
  it('takes them out of their pockets and keeps what was known of them', () => {
    const next = toTray(binder, [at(binder, 0, 0), at(binder, 0, 1)], ctx)

    expect(slot(next, 0, 0)?.cardRef).toBeUndefined()
    expect(slot(next, 0, 1)?.cardRef).toBeUndefined()
    expect(slot(next, 0, 3)?.cardRef).toEqual(glurak)
    expect(trayOf(next).map(({ cardRef, owned, count }) => ({ cardRef, owned, count }))).toEqual([
      { cardRef: pikachu, owned: true, count: 3 },
      { cardRef: mew, owned: false, count: undefined },
    ])
    expect(new Set(trayOf(next).map((card) => card.id)).size).toBe(2)
  })

  it('adds to what lies there already, passes over empty pockets and takes each pocket once', () => {
    const first = toTray(binder, [at(binder, 0, 3)], ctx)
    const next = toTray(first, [at(first, 0, 2), at(first, 0, 0), at(first, 0, 0)], ctx)

    expect(trayOf(next).map((card) => card.cardRef)).toEqual([glurak, pikachu])
    // nothing to lay aside changes nothing
    expect(toTray(next, [at(next, 0, 2)], ctx)).toBe(next)
  })

  it('takes a whole page at once, in reading order', () => {
    const next = pageToTray(binder, binder.pages[0]?.id ?? '', ctx)

    expect(trayOf(next).map((card) => card.cardRef)).toEqual([pikachu, mew, glurak])
    expect(next.pages[0]?.slots.every((entry) => !entry.cardRef)).toBe(true)
  })

  it('keeps a binder without cards laid aside as it always was', () => {
    expect(binder).not.toHaveProperty('tray')
    const laid = toTray(binder, [at(binder, 0, 3)], ctx)
    const back = fromTray(laid, trayOf(laid)[0]?.id ?? '', at(laid, 0, 3), ctx)
    expect(back).not.toHaveProperty('tray')
    expect(back.pages).toEqual(binder.pages)
  })
})

describe('taking cards back', () => {
  it('puts a card into a pocket as it was', () => {
    const laid = toTray(binder, [at(binder, 0, 0)], ctx)
    const next = fromTray(laid, trayOf(laid)[0]?.id ?? '', at(laid, 0, 8), ctx)

    expect(slot(next, 0, 8)).toMatchObject({ cardRef: pikachu, owned: true, count: 3 })
    expect(trayOf(next)).toEqual([])
  })

  it('lays the card of an occupied pocket aside in its place', () => {
    const laid = toTray(binder, [at(binder, 0, 0), at(binder, 0, 1)], ctx)
    const next = fromTray(laid, trayOf(laid)[0]?.id ?? '', at(laid, 0, 3), ctx)

    expect(slot(next, 0, 3)).toMatchObject({ cardRef: pikachu, count: 3 })
    // Glurak takes Pikachu's place in the tray, before Mew
    expect(trayOf(next).map((card) => card.cardRef)).toEqual([glurak, mew])
  })

  it('reaches a pocket on another page, and ignores a card that is not there', () => {
    const laid = addPage(toTray(binder, [at(binder, 0, 3)], ctx), ctx)
    const next = fromTray(laid, trayOf(laid)[0]?.id ?? '', at(laid, 1, 4), ctx)

    expect(slot(next, 1, 4)?.cardRef).toEqual(glurak)
    expect(fromTray(laid, 'nothing', at(laid, 1, 4), ctx)).toBe(laid)
  })
})

describe('cards that never lay in a pocket', () => {
  it('are laid aside as owned, and can be taken out of the binder again', () => {
    const next = addToTray(binder, [mew, glurak], true, ctx)
    expect(trayOf(next)).toMatchObject([
      { cardRef: mew, owned: true },
      { cardRef: glurak, owned: true },
    ])
    expect(addToTray(binder, [], true, ctx)).toBe(binder)

    const one = removeFromTray(next, trayOf(next)[0]?.id ?? '', ctx)
    expect(trayOf(one).map((card) => card.cardRef)).toEqual([glurak])
    const gone = removeFromTray(one, trayOf(one)[0]?.id ?? '', ctx)
    expect(gone).not.toHaveProperty('tray')
    expect(removeFromTray(gone, 'nothing', ctx)).toBe(gone)
  })
})

describe('counting', () => {
  it('goes on counting the cards laid aside as cards of the binder', () => {
    const laid = toTray(binder, [at(binder, 0, 0), at(binder, 0, 1)], ctx)

    expect(countCards(laid)).toBe(countCards(binder))
    expect(countProgress(laid)).toEqual(countProgress(binder))
    expect(countProgress(laid)).toEqual({ total: 3, owned: 2, missing: 1 })
    expect(heldCards(laid).map((card) => card.cardRef)).toEqual([glurak, pikachu, mew])
  })

  it('offers the tray as one more page to whatever goes through the pockets', () => {
    expect(countedPages(binder)).toBe(binder.pages)

    const laid = toTray(binder, [at(binder, 0, 0)], ctx)
    const pages = countedPages(laid)
    expect(pages).toHaveLength(2)
    expect((pages[1]?.index ?? 0) + 1).toBe(TRAY_PAGE)
    expect(pages[1]?.slots).toEqual([{ index: 0, cardRef: pikachu, owned: true, count: 3 }])
  })

  it('finds a card laid aside in the collection, under the page of the tray', () => {
    const laid = toTray(binder, [at(binder, 0, 0)], ctx)

    expect(holdingsOf([laid], pikachu.cardId)).toMatchObject({ copies: 3, places: [{ copies: 3, pages: [TRAY_PAGE] }] })
  })
})
