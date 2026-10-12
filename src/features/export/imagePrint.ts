import type { Binder, ImageCrop } from '../../types/binder'
import { layoutDimensions } from '../binder/binderModel'
import { CARDS_PER_ROW } from './proxyPdf'

/**
 * Printing the collector's own images in their true size: every pocket an image lies
 * behind becomes a piece of 63 × 88 mm, laid out on A4 sheets of 3 × 3 pieces like the
 * placeholder cards, to be cut out and put into the pockets.
 */

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The part of a picture that shows in an area of the given shape, in pixels of the
 * picture. Mirrors how the binder draws it (`cropStyle`): the picture covers the area,
 * `crop.x` / `crop.y` say which part stays in view, and it is magnified by `crop.zoom`
 * around that same point.
 */
export function visibleSource(picture: Size, area: Size, crop: ImageCrop): Rect {
  const scale = Math.max(area.width / picture.width, area.height / picture.height)
  // how much of the scaled picture hangs over the area, and where the area starts in it
  const overX = picture.width * scale - area.width
  const overY = picture.height * scale - area.height
  // the zoom keeps the focus point in place and shows 1 / zoom of the area around it
  const left = crop.x * area.width * (1 - 1 / crop.zoom)
  const top = crop.y * area.height * (1 - 1 / crop.zoom)
  return {
    x: (left + overX * crop.x) / scale,
    y: (top + overY * crop.y) / scale,
    width: area.width / crop.zoom / scale,
    height: area.height / crop.zoom / scale,
  }
}

/** A part of `whole`, given in fractions of its width and height. */
export function partOf(whole: Rect, part: Rect): Rect {
  return {
    x: whole.x + part.x * whole.width,
    y: whole.y + part.y * whole.height,
    width: part.width * whole.width,
    height: part.height * whole.height,
  }
}

/** A block of pockets, counted in pockets. */
export interface Cells {
  col: number
  row: number
  cols: number
  rows: number
}

/** A part of an image that is printed in one piece: at most 3 × 3 pockets of one page. */
export interface PrintPiece {
  imageId: string
  assetId: string
  crop: ImageCrop
  /** Page the pockets belong to, starting at 1. */
  page: number
  /** Size of the whole image in pockets; it may be larger than this piece. */
  span: { cols: number; rows: number }
  /** Which pockets of the image this piece shows. */
  part: Cells
}

/** A piece and where it goes on its sheet of 3 × 3 pockets. */
export interface PlacedPiece extends PrintPiece {
  at: { col: number; row: number }
}

function ranges(length: number, max: number): { from: number; length: number }[] {
  const result = []
  for (let from = 0; from < length; from += max) result.push({ from, length: Math.min(max, length - from) })
  return result
}

/**
 * Every image of the binder cut into the pieces it is printed in, in binder order. An
 * image across the rings is cut where the pages meet, and one larger than 3 × 3 pockets
 * (possible in a 4 × 4 binder) into parts that fit a sheet.
 */
export function printPieces(binder: Binder): PrintPiece[] {
  const { cols: pageCols } = layoutDimensions(binder.layout)
  const pieces: PrintPiece[] = []
  for (const page of binder.pages) {
    for (const image of page.images) {
      const firstCol = image.fromSlot % pageCols
      // columns on the page the image starts on, then those on the facing page
      const onOwnPage = Math.min(image.spanCols, pageCols - firstCol)
      const sides = [
        { page: page.index + 1, from: 0, length: onOwnPage },
        { page: page.index + 2, from: onOwnPage, length: image.spanCols - onOwnPage },
      ].filter((side) => side.length > 0)
      for (const side of sides) {
        for (const rows of ranges(image.spanRows, CARDS_PER_ROW)) {
          for (const cols of ranges(side.length, CARDS_PER_ROW)) {
            pieces.push({
              imageId: image.id,
              assetId: image.assetId,
              crop: image.crop,
              page: side.page,
              span: { cols: image.spanCols, rows: image.spanRows },
              part: { col: side.from + cols.from, row: rows.from, cols: cols.length, rows: rows.length },
            })
          }
        }
      }
    }
  }
  return pieces
}

/**
 * Lays the pieces out on sheets of 3 × 3 pockets, in order: each goes into the first free
 * place of the current sheet, and onto a new sheet when it does not fit there any more.
 */
export function layOutSheets(pieces: readonly PrintPiece[]): PlacedPiece[][] {
  const size = CARDS_PER_ROW
  const sheets: PlacedPiece[][] = []
  let taken = new Set<string>()

  const fits = (piece: PrintPiece, col: number, row: number) => {
    if (col + piece.part.cols > size || row + piece.part.rows > size) return false
    for (let r = row; r < row + piece.part.rows; r++) {
      for (let c = col; c < col + piece.part.cols; c++) if (taken.has(`${c}:${r}`)) return false
    }
    return true
  }
  const freePlace = (piece: PrintPiece) => {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) if (fits(piece, col, row)) return { col, row }
    }
    return undefined
  }

  for (const piece of pieces) {
    let at = sheets.length > 0 ? freePlace(piece) : undefined
    if (!at) {
      sheets.push([])
      taken = new Set()
      at = { col: 0, row: 0 }
    }
    for (let r = at.row; r < at.row + piece.part.rows; r++) {
      for (let c = at.col; c < at.col + piece.part.cols; c++) taken.add(`${c}:${r}`)
    }
    sheets[sheets.length - 1]?.push({ ...piece, at })
  }
  return sheets
}

/** A pocket holds a card of 63 × 88 mm; an image over several pockets is that many times as large. */
const POCKET_MM = { width: 63, height: 88 }

/** The section of the picture that a piece shows, in pixels of the picture. */
export function pieceSource(picture: Size, piece: PrintPiece): Rect {
  const whole = visibleSource(
    picture,
    { width: piece.span.cols * POCKET_MM.width, height: piece.span.rows * POCKET_MM.height },
    piece.crop,
  )
  return partOf(whole, {
    x: piece.part.col / piece.span.cols,
    y: piece.part.row / piece.span.rows,
    width: piece.part.cols / piece.span.cols,
    height: piece.part.rows / piece.span.rows,
  })
}
