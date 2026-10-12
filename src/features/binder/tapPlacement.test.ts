import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { addPage, createBinder, setCard, type ModelContext } from './binderModel'
import { nextEmptyAfter, tapTarget } from './tapPlacement'

let ctx: ModelContext
/** 2 × 2 binder with two pages. */
let binder: Binder

const at = (index: number) => ({ pageId: binder.pages[Math.floor(index / 4)]?.id ?? '', slotIndex: index % 4 })

function fill(...indices: number[]): Binder {
  let filled = binder
  for (const index of indices) {
    filled = setCard(filled, at(index), { cardId: `c${index}`, lang: 'de', variant: 'normal' }, true, ctx)
  }
  return filled
}

beforeEach(() => {
  ctx = createTestContext()
  binder = addPage(createBinder({ name: 'Test', layout: '2x2' }, ctx), ctx)
})

describe('tapTarget', () => {
  it('is the selected pocket, with page and pocket counted from one', () => {
    expect(tapTarget(binder, at(6), 0)).toEqual({ position: at(6), page: 2, pocket: 3 })
  })

  it('is the selected pocket even when a card lies there: that is what was pointed at', () => {
    expect(tapTarget(fill(1), at(1), 0)?.position).toEqual(at(1))
  })

  it('is the first empty pocket of the open page when nothing is selected', () => {
    expect(tapTarget(fill(0, 1), null, 0)).toEqual({ position: at(2), page: 1, pocket: 3 })
    // pages before the open one are not filled behind the collector's back
    expect(tapTarget(binder, null, 1)).toEqual({ position: at(4), page: 2, pocket: 1 })
  })

  it('goes on to the next page when the open one is full', () => {
    expect(tapTarget(fill(0, 1, 2, 3), null, 0)?.position).toEqual(at(4))
  })

  it('is nothing when no pocket is free from the open page on, or the selection is gone', () => {
    expect(tapTarget(fill(4, 5, 6, 7), null, 1)).toBeUndefined()
    // a selection that points nowhere falls back to the first empty pocket
    expect(tapTarget(binder, { pageId: 'gone', slotIndex: 0 }, 0)?.position).toEqual(at(0))
  })
})

describe('nextEmptyAfter', () => {
  it('is the next empty pocket in reading order, across pages', () => {
    expect(nextEmptyAfter(fill(0), at(0))).toEqual({ position: at(1), page: 1, pocket: 2 })
    expect(nextEmptyAfter(fill(0, 1, 2, 3), at(1))?.position).toEqual(at(4))
    // pockets that are taken are passed over
    expect(nextEmptyAfter(fill(0, 1, 3), at(0))?.position).toEqual(at(2))
  })

  it('never goes back, and is nothing at the end of the binder', () => {
    expect(nextEmptyAfter(fill(2), at(2))?.position).toEqual(at(3))
    expect(nextEmptyAfter(fill(5, 6, 7), at(5))).toBeUndefined()
    expect(nextEmptyAfter(fill(7), at(7))).toBeUndefined()
  })
})
