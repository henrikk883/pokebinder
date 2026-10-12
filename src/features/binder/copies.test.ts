// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, Slot } from '../../types/binder'
import { createBackup, parseBackup, serializeBackup } from '../export/backup'
import { cardCount, shoppingTotal, withinBudget, type ShoppingRow } from '../export/shopping'
import {
  addPage,
  changeLayout,
  copiesOf,
  createBinder,
  duplicatePage,
  insertGap,
  MAX_COPIES,
  moveCard,
  setCard,
  setCardLang,
  setCount,
  setOwned,
  setVariant,
  sortCards,
  type ModelContext,
} from './binderModel'
import { summarizeValue } from './binderValue'

let ctx: ModelContext
/** One page; "a" in pocket 1 (owned), "b" in pocket 2 (owned), "c" in pocket 3 (missing). */
let binder: Binder

const at = (slotIndex: number, pageIndex = 0) => ({ pageId: binder.pages[pageIndex]?.id ?? '', slotIndex })
const slotOf = (source: Binder, slotIndex: number, pageIndex = 0): Slot | undefined =>
  source.pages[pageIndex]?.slots[slotIndex]
const find = (source: Binder, cardId: string) =>
  source.pages.flatMap((page) => page.slots).find((slot) => slot.cardRef?.cardId === cardId)

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
  binder = setCard(binder, at(0), { cardId: 'a', lang: 'de', variant: 'normal' }, true, ctx)
  binder = setCard(binder, at(1), { cardId: 'b', lang: 'de', variant: 'normal' }, true, ctx)
  binder = setCard(binder, at(2), { cardId: 'c', lang: 'de', variant: 'normal' }, false, ctx)
})

describe('setCount', () => {
  it('says how many copies of a card there are', () => {
    const counted = setCount(binder, at(0), 3, ctx)

    expect(slotOf(counted, 0)?.count).toBe(3)
    expect(copiesOf(slotOf(counted, 0) ?? { owned: false })).toBe(3)
  })

  it('stores nothing for a single copy', () => {
    const back = setCount(setCount(binder, at(0), 3, ctx), at(0), 1, ctx)

    expect(slotOf(back, 0)).toEqual({ index: 0, owned: true, cardRef: { cardId: 'a', lang: 'de', variant: 'normal' } })
    expect(setCount(binder, at(0), 1, ctx)).toBe(binder)
  })

  it('stays between one and ninety-nine', () => {
    expect(slotOf(setCount(binder, at(0), 500, ctx), 0)?.count).toBe(MAX_COPIES)
    expect(slotOf(setCount(setCount(binder, at(0), 4, ctx), at(0), 0, ctx), 0)?.count).toBeUndefined()
    expect(slotOf(setCount(binder, at(0), 2.6, ctx), 0)?.count).toBe(3)
  })

  it('counts only cards that are there', () => {
    expect(setCount(binder, at(2), 3, ctx)).toBe(binder)
    expect(setCount(binder, at(5), 3, ctx)).toBe(binder)
    expect(copiesOf(slotOf(binder, 2) ?? { owned: false })).toBe(0)
    expect(copiesOf(slotOf(binder, 5) ?? { owned: false })).toBe(0)
    expect(copiesOf(slotOf(binder, 0) ?? { owned: false })).toBe(1)
  })

  it('is forgotten when the card is marked as missing', () => {
    const counted = setCount(binder, at(0), 3, ctx)

    const missing = setOwned(counted, at(0), false, ctx)

    expect(slotOf(missing, 0)?.count).toBeUndefined()
    expect(slotOf(setOwned(missing, at(0), true, ctx), 0)?.count).toBeUndefined()
  })
})

describe('the number stays with its card', () => {
  let counted: Binder

  beforeEach(() => {
    counted = setCount(binder, at(0), 3, ctx)
  })

  it('when the card moves, swaps places or makes room', () => {
    expect(slotOf(moveCard(counted, at(0), at(5), ctx), 5)?.count).toBe(3)
    const swapped = moveCard(counted, at(1), at(0), ctx)
    expect(slotOf(swapped, 1)).toMatchObject({ cardRef: { cardId: 'a' }, count: 3 })
    expect(slotOf(swapped, 0)?.count).toBeUndefined()
    expect(slotOf(insertGap(counted, at(0), ctx), 1)).toMatchObject({ cardRef: { cardId: 'a' }, count: 3 })
  })

  it('when its finish or language changes', () => {
    expect(slotOf(setVariant(counted, at(0), 'reverse', ctx), 0)).toMatchObject({ count: 3, cardRef: { variant: 'reverse' } })
    expect(slotOf(setCardLang(counted, at(0), 'en', ctx), 0)).toMatchObject({ count: 3, cardRef: { lang: 'en' } })
  })

  it('when the binder is sorted or gets another layout', () => {
    const sorted = sortCards(counted, {}, (x, y) => y.cardRef.cardId.localeCompare(x.cardRef.cardId), ctx)
    expect(find(sorted, 'a')?.count).toBe(3)
    expect(find(sorted, 'b')?.count).toBeUndefined()
    expect(find(changeLayout(counted, '2x2', ctx), 'a')?.count).toBe(3)
  })

  it('when its page is copied', () => {
    const copied = duplicatePage(addPage(counted, ctx), counted.pages[0]?.id ?? '', ctx)

    expect(slotOf(copied, 0, 1)).toMatchObject({ cardRef: { cardId: 'a' }, count: 3 })
  })

  it('through a backup, and files without numbers are read as before', async () => {
    const restored = parseBackup(serializeBackup(await createBackup(counted, []))).binder

    expect(slotOf(restored, 0)?.count).toBe(3)
    expect(slotOf(restored, 1)?.count).toBeUndefined()
    expect(parseBackup(serializeBackup(await createBackup(binder, []))).binder).toEqual(binder)
  })

  it('but a backup that counts a missing card or less than one is put right or refused', async () => {
    const file = await createBackup(counted, [])
    const odd = JSON.parse(serializeBackup(file)) as { binder: { pages: { slots: Record<string, unknown>[] }[] } }
    const slots = odd.binder.pages[0]?.slots ?? []
    // a number on a card that is missing says nothing
    if (slots[2]) slots[2].count = 4
    expect(slotOf(parseBackup(JSON.stringify(odd)).binder, 2)?.count).toBeUndefined()
    if (slots[0]) slots[0].count = 0
    expect(() => parseBackup(JSON.stringify(odd))).toThrow()
  })
})

describe('what copies are worth', () => {
  it('counts every copy of an owned card in the value of the binder', () => {
    const value = summarizeValue([
      { owned: true, price: 2.5, copies: 3 },
      { owned: true, price: 1 },
      { owned: false, price: 4, copies: 2 },
    ])

    expect(value).toEqual({ owned: 8.5, missing: 4, unpriced: 0 })
  })

  it('counts the pieces of a line in a list of cards', () => {
    const line = (key: string, price: number | undefined, count?: number): ShoppingRow => ({
      key,
      cardId: key,
      lang: 'de',
      variant: 'normal',
      name: key,
      setName: '',
      number: '',
      ...(price === undefined ? {} : { price }),
      ...(count === undefined ? {} : { count }),
    })
    const rows = [line('a', 2.5, 2), line('b', 1), line('c', undefined, 3)]

    expect(cardCount(rows)).toBe(6)
    expect(shoppingTotal(rows)).toEqual({ total: 6, unpriced: 3 })
    // two pieces at 2.50 do not fit into 4, the single card at 1 does
    expect([...withinBudget(rows, 4).affordable]).toEqual(['b'])
  })
})
