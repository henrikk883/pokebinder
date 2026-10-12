import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { addPage, changeLayout, createBinder, type ModelContext } from '../binder/binderModel'
import { placeImage, setImageCrop, type Placement } from '../images/imageModel'
import { layOutSheets, partOf, pieceSource, printPieces, visibleSource, type PrintPiece } from './imagePrint'

let ctx: ModelContext
/** 3 × 3 binder with three pages: 1 alone, then the spread 2–3. */
let binder: Binder

function place(source: Binder, pageIndex: number, placement: Placement, assetId = 'asset'): Binder {
  const result = placeImage(source, source.pages[pageIndex]?.id ?? '', assetId, placement, ctx)
  if (!result.ok) throw new Error(`Placement refused: ${result.error}`)
  return result.binder
}

const round = (rect: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(rect.x * 100) / 100,
  y: Math.round(rect.y * 100) / 100,
  width: Math.round(rect.width * 100) / 100,
  height: Math.round(rect.height * 100) / 100,
})

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
  binder = addPage(addPage(binder, ctx), ctx)
})

describe('visibleSource', () => {
  const centre = { x: 0.5, y: 0.5, zoom: 1 }

  it('shows all of a picture that has the shape of its area', () => {
    expect(visibleSource({ width: 630, height: 880 }, { width: 63, height: 88 }, centre)).toEqual({
      x: 0,
      y: 0,
      width: 630,
      height: 880,
    })
  })

  it('cuts a picture that is too wide at both sides, or where the focus says', () => {
    // 1000 × 880 in an area of 63 × 88: 630 px of the width fit
    const picture = { width: 1000, height: 880 }
    const area = { width: 63, height: 88 }

    expect(round(visibleSource(picture, area, centre))).toEqual({ x: 185, y: 0, width: 630, height: 880 })
    expect(round(visibleSource(picture, area, { x: 0, y: 0.5, zoom: 1 }))).toEqual({ x: 0, y: 0, width: 630, height: 880 })
    expect(round(visibleSource(picture, area, { x: 1, y: 0.5, zoom: 1 }))).toEqual({ x: 370, y: 0, width: 630, height: 880 })
  })

  it('cuts a picture that is too high at top and bottom', () => {
    expect(round(visibleSource({ width: 630, height: 1000 }, { width: 63, height: 88 }, centre))).toEqual({
      x: 0,
      y: 60,
      width: 630,
      height: 880,
    })
  })

  it('magnifies around the focus point', () => {
    const picture = { width: 630, height: 880 }
    const area = { width: 63, height: 88 }

    // twice as large around the middle: the middle half in each direction
    expect(round(visibleSource(picture, area, { x: 0.5, y: 0.5, zoom: 2 }))).toEqual({
      x: 157.5,
      y: 220,
      width: 315,
      height: 440,
    })
    // around the top left corner: that corner stays where it is
    expect(round(visibleSource(picture, area, { x: 0, y: 0, zoom: 2 }))).toEqual({ x: 0, y: 0, width: 315, height: 440 })
    // around the bottom right corner
    expect(round(visibleSource(picture, area, { x: 1, y: 1, zoom: 4 }))).toEqual({
      x: 472.5,
      y: 660,
      width: 157.5,
      height: 220,
    })
  })

  it('never reaches outside the picture', () => {
    for (const crop of [
      { x: 0, y: 0, zoom: 1 },
      { x: 1, y: 1, zoom: 1 },
      { x: 0.3, y: 0.8, zoom: 3.3 },
    ]) {
      const source = visibleSource({ width: 1234, height: 777 }, { width: 189, height: 88 }, crop)
      expect(source.x).toBeGreaterThanOrEqual(-1e-9)
      expect(source.y).toBeGreaterThanOrEqual(-1e-9)
      expect(source.x + source.width).toBeLessThanOrEqual(1234 + 1e-9)
      expect(source.y + source.height).toBeLessThanOrEqual(777 + 1e-9)
    }
  })
})

describe('partOf', () => {
  it('takes a part given in fractions', () => {
    expect(partOf({ x: 100, y: 50, width: 600, height: 400 }, { x: 0.5, y: 0.25, width: 0.5, height: 0.5 })).toEqual({
      x: 400,
      y: 150,
      width: 300,
      height: 200,
    })
  })
})

describe('printPieces', () => {
  it('prints an image on one page in one piece', () => {
    const placed = place(binder, 0, { fromSlot: 4, spanCols: 2, spanRows: 2 })

    expect(printPieces(placed)).toMatchObject([
      { assetId: 'asset', page: 1, span: { cols: 2, rows: 2 }, part: { col: 0, row: 0, cols: 2, rows: 2 } },
    ])
  })

  it('cuts an image across the rings where the pages meet', () => {
    // from the last column of page 2 over all of page 3
    const placed = place(binder, 1, { fromSlot: 2, spanCols: 4, spanRows: 1 })

    expect(printPieces(placed).map((piece) => [piece.page, piece.part])).toEqual([
      [2, { col: 0, row: 0, cols: 1, rows: 1 }],
      [3, { col: 1, row: 0, cols: 3, rows: 1 }],
    ])
  })

  it('cuts an image larger than a sheet into parts of at most 3 × 3 pockets', () => {
    const large = changeLayout(binder, '4x4', ctx)
    const placed = place(large, 0, { fromSlot: 0, spanCols: 4, spanRows: 4 })

    expect(printPieces(placed).map((piece) => piece.part)).toEqual([
      { col: 0, row: 0, cols: 3, rows: 3 },
      { col: 3, row: 0, cols: 1, rows: 3 },
      { col: 0, row: 3, cols: 3, rows: 1 },
      { col: 3, row: 3, cols: 1, rows: 1 },
    ])
  })

  it('lists the images in binder order and keeps their crop', () => {
    let placed = place(binder, 2, { fromSlot: 0, spanCols: 1, spanRows: 1 }, 'late')
    placed = place(placed, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 }, 'early')
    const imageId = placed.pages[0]?.images[0]?.id ?? ''
    placed = setImageCrop(placed, placed.pages[0]?.id ?? '', imageId, { x: 0.2, y: 0.7, zoom: 2 }, ctx)

    const pieces = printPieces(placed)

    expect(pieces.map((piece) => piece.assetId)).toEqual(['early', 'late'])
    expect(pieces[0]?.crop).toEqual({ x: 0.2, y: 0.7, zoom: 2 })
    expect(printPieces(binder)).toEqual([])
  })
})

describe('layOutSheets', () => {
  const piece = (cols: number, rows: number, imageId: string): PrintPiece => ({
    imageId,
    assetId: imageId,
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    page: 1,
    span: { cols, rows },
    part: { col: 0, row: 0, cols, rows },
  })
  const places = (pieces: PrintPiece[]) =>
    layOutSheets(pieces).map((sheet) => sheet.map((placed) => `${placed.imageId}@${placed.at.col},${placed.at.row}`))

  it('fills a sheet of 3 × 3 pockets before starting the next', () => {
    const singles = Array.from({ length: 10 }, (_, index) => piece(1, 1, `i${index}`))

    const sheets = places(singles)

    expect(sheets).toHaveLength(2)
    expect(sheets[0]).toEqual(['i0@0,0', 'i1@1,0', 'i2@2,0', 'i3@0,1', 'i4@1,1', 'i5@2,1', 'i6@0,2', 'i7@1,2', 'i8@2,2'])
    expect(sheets[1]).toEqual(['i9@0,0'])
  })

  it('puts pieces of different sizes next to and below each other without overlap', () => {
    expect(places([piece(2, 2, 'a'), piece(1, 1, 'b'), piece(3, 1, 'c'), piece(1, 1, 'd')])).toEqual([
      // "b" beside "a", "c" in the row below both, "d" in the gap under "b"
      ['a@0,0', 'b@2,0', 'c@0,2', 'd@2,1'],
    ])
  })

  it('keeps the order of the binder: nothing goes back to an earlier sheet', () => {
    // "c" is three pockets high and does not fit beside "a"; "d" then follows "c"
    expect(places([piece(2, 2, 'a'), piece(1, 1, 'b'), piece(1, 3, 'c'), piece(1, 1, 'd')])).toEqual([
      ['a@0,0', 'b@2,0'],
      ['c@0,0', 'd@1,0'],
    ])
  })

  it('gives a whole sheet to a piece of 3 × 3 pockets', () => {
    expect(places([piece(1, 1, 'a'), piece(3, 3, 'b'), piece(1, 1, 'c')])).toEqual([['a@0,0'], ['b@0,0'], ['c@0,0']])
    expect(layOutSheets([])).toEqual([])
  })
})

describe('pieceSource', () => {
  it('shows in each piece its share of the picture', () => {
    // a picture in the shape of two pockets side by side, over two pockets, cut in two
    const picture = { width: 1260, height: 880 }
    const base = { imageId: 'i', assetId: 'a', crop: { x: 0.5, y: 0.5, zoom: 1 }, page: 1, span: { cols: 2, rows: 1 } }

    expect(round(pieceSource(picture, { ...base, part: { col: 0, row: 0, cols: 1, rows: 1 } }))).toEqual({
      x: 0,
      y: 0,
      width: 630,
      height: 880,
    })
    expect(round(pieceSource(picture, { ...base, part: { col: 1, row: 0, cols: 1, rows: 1 } }))).toEqual({
      x: 630,
      y: 0,
      width: 630,
      height: 880,
    })
  })
})
