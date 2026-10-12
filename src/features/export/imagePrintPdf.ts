import { PDFDocument, rgb } from 'pdf-lib'
import { embedFonts, printable } from './pdfText'
import { A4_MM, cardRect, CARDS_PER_ROW, cutMarks, mm, type Rect } from './proxyPdf'

/** A piece of an image, ready to print: its picture and the pockets it fills on the sheet. */
export interface PrintedPiece {
  jpeg: Uint8Array
  at: { col: number; row: number }
  cols: number
  rows: number
}

export interface ImagePrintPdfInput {
  title: string
  /** Printed small at the bottom of every sheet, e.g. the reminder to print at 100 %. */
  footer: (sheet: number, sheetCount: number) => string
  /** One entry per A4 sheet. */
  sheets: readonly (readonly PrintedPiece[])[]
}

/**
 * Where a piece goes on the sheet, in points from the bottom left corner of the page: it
 * fills whole places of the 3 × 3 grid the placeholder cards use, so each of its pockets
 * measures 63 × 88 mm.
 */
export function pieceRect(piece: Pick<PrintedPiece, 'at' | 'cols' | 'rows'>): Rect {
  const first = cardRect(piece.at.row * CARDS_PER_ROW + piece.at.col)
  const lastRow = cardRect((piece.at.row + piece.rows - 1) * CARDS_PER_ROW + piece.at.col)
  return { x: first.x, y: lastRow.y, width: first.width * piece.cols, height: first.height * piece.rows }
}

/**
 * The collector's own images to print in their true size: pieces on A4 sheets with cut
 * marks along every pocket edge. Printed at 100 % and cut along the marks, every piece
 * fits its pocket.
 */
export async function createImagePrintPdf(input: ImagePrintPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(input.title)
  const { regular: font } = await embedFonts(pdf)
  const ink = rgb(0.1, 0.1, 0.12)
  const faint = rgb(0.5, 0.5, 0.55)

  for (const [index, pieces] of input.sheets.entries()) {
    const page = pdf.addPage([mm(A4_MM.width), mm(A4_MM.height)])
    for (const piece of pieces) {
      page.drawImage(await pdf.embedJpg(piece.jpeg), pieceRect(piece))
    }
    // after the pictures, so that no picture hides a mark
    for (const mark of cutMarks()) {
      page.drawLine({ start: mark.from, end: mark.to, thickness: 0.4, color: ink })
    }
    const footer = printable(input.footer(index + 1, input.sheets.length), font)
    page.drawText(footer, {
      x: (mm(A4_MM.width) - font.widthOfTextAtSize(footer, 7)) / 2,
      y: mm(6),
      size: 7,
      font,
      color: faint,
    })
  }

  // an empty document is not a valid PDF for every viewer
  if (input.sheets.length === 0) pdf.addPage([mm(A4_MM.width), mm(A4_MM.height)])
  return pdf.save()
}
