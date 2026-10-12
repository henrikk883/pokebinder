// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createImagePrintPdf, pieceRect, type PrintedPiece } from './imagePrintPdf'

/** Points back to millimetres, rounded to a hundredth. */
const toMm = (points: number) => Math.round((points * 25.4 * 100) / 72) / 100

/** A 1 × 1 pixel grey JPEG. */
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  ),
  (char) => char.charCodeAt(0),
)

const piece = (col: number, row: number, cols: number, rows: number): PrintedPiece => ({
  jpeg: JPEG,
  at: { col, row },
  cols,
  rows,
})

describe('pieceRect', () => {
  it('makes every pocket of a piece exactly 63 × 88 mm', () => {
    const single = pieceRect(piece(0, 0, 1, 1))
    expect([toMm(single.width), toMm(single.height)]).toEqual([63, 88])

    const wide = pieceRect(piece(0, 1, 3, 1))
    expect([toMm(wide.width), toMm(wide.height)]).toEqual([189, 88])

    const whole = pieceRect(piece(0, 0, 3, 3))
    expect([toMm(whole.width), toMm(whole.height)]).toEqual([189, 264])
  })

  it('places pieces on the grid of the sheet, centred on A4', () => {
    // the block of 3 × 3 pockets is 189 × 264 mm: 10.5 mm from the sides, 16.5 mm from top and bottom
    const topLeft = pieceRect(piece(0, 0, 1, 1))
    expect([toMm(topLeft.x), toMm(topLeft.y + topLeft.height)]).toEqual([10.5, 280.5])

    const bottomRight = pieceRect(piece(2, 2, 1, 1))
    expect([toMm(bottomRight.x + bottomRight.width), toMm(bottomRight.y)]).toEqual([199.5, 16.5])

    // two pockets high, starting in the middle row: reaches down to the bottom of the block
    const tall = pieceRect(piece(1, 1, 1, 2))
    expect([toMm(tall.x), toMm(tall.y), toMm(tall.height)]).toEqual([73.5, 16.5, 176])
  })
})

describe('createImagePrintPdf', () => {
  const input = (sheets: PrintedPiece[][]) => ({
    title: 'Bilder – Test',
    footer: (sheet: number, count: number) => `Blatt ${sheet} von ${count}`,
    sheets,
  })

  it('makes one A4 page per sheet', async () => {
    const pdf = await PDFDocument.load(
      await createImagePrintPdf(input([[piece(0, 0, 2, 2), piece(2, 0, 1, 1)], [piece(0, 0, 3, 3)]])),
    )

    expect(pdf.getTitle()).toBe('Bilder – Test')
    expect(pdf.getPageCount()).toBe(2)
    const { width, height } = pdf.getPage(0).getSize()
    expect([toMm(width), toMm(height)]).toEqual([210, 297])
  })

  it('still gives a valid document when there is no image', async () => {
    const pdf = await PDFDocument.load(await createImagePrintPdf(input([])))

    expect(pdf.getPageCount()).toBe(1)
  })
})
