import { PDFDocument, rgb, type PDFImage } from 'pdf-lib'
import { embedFonts, fontFor, printable } from './pdfText'

/** Millimetres to PDF points. */
export const mm = (value: number) => (value * 72) / 25.4

/** DIN A4 and a standard trading card, in millimetres. */
export const A4_MM = { width: 210, height: 297 }
export const CARD_MM = { width: 63, height: 88 }
export const CARDS_PER_ROW = 3
export const CARDS_PER_SHEET = 9

/** Cut marks start this far outside the cards and are this long, in millimetres. */
const MARK_GAP_MM = 1.5
const MARK_LENGTH_MM = 5

export interface ProxyCard {
  name: string
  /** Number as printed, e.g. `025/165`; shown on cards without a picture. */
  number: string
  /** The card picture as a JPEG, already in black and white; missing if there is none. */
  jpeg?: Uint8Array
  /**
   * Names the picture. Cards with the same key (a card and its reverse holo) share one
   * copy of it in the file, which keeps a large master set printable.
   */
  imageKey?: string
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Where the nine cards of a sheet go, in points from the bottom left corner of the page.
 * The block of 3 × 3 cards (189 × 264 mm) sits in the middle of the sheet; cards are
 * numbered left to right, top to bottom, like the pockets of a binder page.
 */
export function cardRect(position: number): Rect {
  const column = position % CARDS_PER_ROW
  const row = Math.floor(position / CARDS_PER_ROW)
  const left = (A4_MM.width - CARDS_PER_ROW * CARD_MM.width) / 2
  const top = (A4_MM.height - CARDS_PER_ROW * CARD_MM.height) / 2
  return {
    x: mm(left + column * CARD_MM.width),
    y: mm(A4_MM.height - top - (row + 1) * CARD_MM.height),
    width: mm(CARD_MM.width),
    height: mm(CARD_MM.height),
  }
}

export interface Line {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * Short lines outside the block of cards, in line with every edge to cut along:
 * four vertical and four horizontal cuts, marked at both ends.
 */
export function cutMarks(): Line[] {
  const first = cardRect(0)
  const last = cardRect(CARDS_PER_SHEET - 1)
  const left = first.x
  const right = last.x + last.width
  const top = first.y + first.height
  const bottom = last.y
  const gap = mm(MARK_GAP_MM)
  const length = mm(MARK_LENGTH_MM)
  const marks: Line[] = []

  for (let i = 0; i <= CARDS_PER_ROW; i++) {
    const x = left + i * first.width
    marks.push({ from: { x, y: top + gap }, to: { x, y: top + gap + length } })
    marks.push({ from: { x, y: bottom - gap }, to: { x, y: bottom - gap - length } })
    const y = top - i * first.height
    marks.push({ from: { x: left - gap, y }, to: { x: left - gap - length, y } })
    marks.push({ from: { x: right + gap, y }, to: { x: right + gap + length, y } })
  }
  return marks
}

export function sheetsNeeded(cardCount: number): number {
  return Math.ceil(cardCount / CARDS_PER_SHEET)
}

export interface ProxyPdfInput {
  title: string
  /** Printed small at the bottom of every sheet, e.g. the reminder to print at 100 %. */
  footer: (sheet: number, sheetCount: number) => string
  cards: readonly ProxyCard[]
  /** File of the font for Japanese (see `pdfFont.ts`), for the names of cards without a picture. */
  wideFont?: Uint8Array
}

/**
 * Placeholder cards to print: nine per A4 sheet, each exactly 63 × 88 mm when printed at
 * 100 %, with cut marks, in the order given.
 */
export async function createProxyPdf(input: ProxyPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(input.title)
  const fonts = await embedFonts(pdf, input.wideFont)
  const font = fonts.regular
  const ink = rgb(0.1, 0.1, 0.12)
  const faint = rgb(0.5, 0.5, 0.55)
  const sheetCount = sheetsNeeded(input.cards.length)
  const embedded = new Map<string, PDFImage>()

  async function pictureOf(card: ProxyCard, jpeg: Uint8Array): Promise<PDFImage> {
    const known = card.imageKey === undefined ? undefined : embedded.get(card.imageKey)
    if (known) return known
    const image = await pdf.embedJpg(jpeg)
    if (card.imageKey !== undefined) embedded.set(card.imageKey, image)
    return image
  }

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const page = pdf.addPage([mm(A4_MM.width), mm(A4_MM.height)])
    for (const mark of cutMarks()) {
      page.drawLine({ start: mark.from, end: mark.to, thickness: 0.4, color: ink })
    }

    const cards = input.cards.slice(sheet * CARDS_PER_SHEET, (sheet + 1) * CARDS_PER_SHEET)
    for (const [position, card] of cards.entries()) {
      const rect = cardRect(position)
      if (card.jpeg) {
        page.drawImage(await pictureOf(card, card.jpeg), rect)
        continue
      }
      // no picture anywhere: a frame with name and number still holds the place in the binder
      page.drawRectangle({ ...rect, borderColor: faint, borderWidth: 0.6 })
      const lines = [card.name, card.number].filter((line) => line !== '')
      lines.forEach((line, index) => {
        const size = index === 0 ? 11 : 9
        const lineFont = fontFor(line, font, fonts)
        let text = printable(line, lineFont)
        while (text.length > 1 && lineFont.widthOfTextAtSize(text, size) > rect.width - 16) {
          text = text.slice(0, -1)
        }
        page.drawText(text, {
          x: rect.x + (rect.width - lineFont.widthOfTextAtSize(text, size)) / 2,
          y: rect.y + rect.height / 2 - index * 16,
          size,
          font: lineFont,
          color: index === 0 ? ink : faint,
        })
      })
    }

    const footer = printable(input.footer(sheet + 1, sheetCount), font)
    page.drawText(footer, {
      x: (mm(A4_MM.width) - font.widthOfTextAtSize(footer, 7)) / 2,
      y: mm(6),
      size: 7,
      font,
      color: faint,
    })
  }

  // an empty document is not a valid PDF for every viewer
  if (sheetCount === 0) pdf.addPage([mm(A4_MM.width), mm(A4_MM.height)])
  return pdf.save()
}
