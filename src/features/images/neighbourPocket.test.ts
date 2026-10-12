import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { addPage, createBinder, type ModelContext } from '../binder/binderModel'
import { moveImage, neighbourPocket, placeImage } from './imageModel'

let ctx: ModelContext
/** 3 × 3 binder with three pages: 1 alone on the right, then 2 (left) and 3 (right) facing each other. */
let binder: Binder

const at = (pageIndex: number, slotIndex: number) => ({ pageId: binder.pages[pageIndex]?.id ?? '', slotIndex })

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
  binder = addPage(addPage(binder, ctx), ctx)
})

describe('neighbourPocket', () => {
  it('finds the pocket beside, above and below within a page', () => {
    expect(neighbourPocket(binder, at(0, 4), 'left')).toEqual(at(0, 3))
    expect(neighbourPocket(binder, at(0, 4), 'right')).toEqual(at(0, 5))
    expect(neighbourPocket(binder, at(0, 4), 'up')).toEqual(at(0, 1))
    expect(neighbourPocket(binder, at(0, 4), 'down')).toEqual(at(0, 7))
  })

  it('ends at the top and the bottom of a page', () => {
    expect(neighbourPocket(binder, at(0, 1), 'up')).toBeUndefined()
    expect(neighbourPocket(binder, at(0, 7), 'down')).toBeUndefined()
  })

  it('crosses the rings between facing pages, in the same row', () => {
    // from the last column of page 2 to the first of page 3, and back
    expect(neighbourPocket(binder, at(1, 5), 'right')).toEqual(at(2, 3))
    expect(neighbourPocket(binder, at(2, 3), 'left')).toEqual(at(1, 5))
  })

  it('ends at the outer edges of the binder and beside the cover', () => {
    // page 1 lies alone beside the cover
    expect(neighbourPocket(binder, at(0, 0), 'left')).toBeUndefined()
    expect(neighbourPocket(binder, at(0, 2), 'right')).toBeUndefined()
    // outer edges of the spread 2–3
    expect(neighbourPocket(binder, at(1, 0), 'left')).toBeUndefined()
    expect(neighbourPocket(binder, at(2, 2), 'right')).toBeUndefined()
  })

  it('ends at the rings where a left-hand page has nothing facing it', () => {
    const four = addPage(binder, ctx)
    const last = { pageId: four.pages[3]?.id ?? '', slotIndex: 2 }

    expect(neighbourPocket(four, last, 'right')).toBeUndefined()
  })

  it('gives moveImage the step that moves an image by one pocket', () => {
    const placed = placeImage(binder, at(0, 0).pageId, 'asset', { fromSlot: 0, spanCols: 1, spanRows: 1 }, ctx)
    if (!placed.ok) throw new Error('Placement refused')
    const target = neighbourPocket(placed.binder, at(0, 0), 'right')
    if (!target) throw new Error('Expected a neighbour')

    const moved = moveImage(placed.binder, at(0, 0), target, ctx)

    expect(moved.ok && moved.binder.pages[0]?.images[0]?.fromSlot).toBe(1)
  })
})
