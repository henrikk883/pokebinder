import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { CardLang } from '../../types/binder'
import { hasSeveralLanguages, type MissingRow } from './missingList'

export interface MissingListPdfInput {
  title: string
  /** Line under the title, e.g. date and number of cards. */
  subtitle: string
  /** Shown instead of the table when nothing is missing. */
  emptyText: string
  columns: Record<ColumnKey, string>
  rows: readonly MissingRow[]
  variantLabel: (variant: string) => string
  languageLabel: (lang: CardLang) => string
  pageLabel: (page: number, pageCount: number) => string
}

// A4 in points
const PAGE = { width: 595.28, height: 841.89, margin: 40 }
const ROW_HEIGHT = 18
const BOX = 10
const FONT_SIZE = 9

type ColumnKey = 'set' | 'lang' | 'number' | 'name' | 'variant' | 'rarity'
interface Column {
  key: ColumnKey
  x: number
  width: number
}

/** Columns after the checkbox: x position and width in points. */
const COLUMNS: readonly Column[] = [
  { key: 'set', x: 60, width: 130 },
  { key: 'number', x: 195, width: 55 },
  { key: 'name', x: 255, width: 140 },
  { key: 'variant', x: 400, width: 70 },
  { key: 'rarity', x: 475, width: 80 },
]

/** With a column for the language, for binders that mix languages. */
const COLUMNS_WITH_LANGUAGE: readonly Column[] = [
  { key: 'set', x: 60, width: 112 },
  { key: 'lang', x: 177, width: 24 },
  { key: 'number', x: 206, width: 52 },
  { key: 'name', x: 263, width: 134 },
  { key: 'variant', x: 402, width: 68 },
  { key: 'rarity', x: 475, width: 80 },
]

/** Name of the checkbox of a row; lets a filled-in list be matched to its cards again. */
export function checkboxName(index: number, row: Pick<MissingRow, 'cardId' | 'variant'>): string {
  return `fehlt_${index + 1}_${row.cardId}_${row.variant}`
}

/** The standard PDF fonts know Western European letters only; others are replaced. */
function printable(text: string, font: PDFFont): string {
  const known = new Set(font.getCharacterSet())
  const replacements: Record<string, string> = { '♀': ' (w)', '♂': ' (m)', '★': '*', '’': "'", '–': '-' }
  let result = ''
  for (const char of text) {
    const replaced = replacements[char] ?? char
    for (const piece of replaced) result += known.has(piece.codePointAt(0) ?? 0) ? piece : '?'
  }
  return result
}

/**
 * Text the font can show, or `fallback` where it cannot: Japanese names and sets would
 * come out as question marks, so their id is printed instead.
 */
function readable(text: string, fallback: string, font: PDFFont): string {
  return printable(text, font).includes('?') && !text.includes('?') ? fallback : text
}

function fitted(text: string, font: PDFFont, size: number, width: number): string {
  const clean = printable(text, font)
  if (font.widthOfTextAtSize(clean, size) <= width) return clean
  let cut = clean
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1)
  return `${cut}…`
}

/**
 * The checklist of missing cards as a PDF: one row per card with a checkbox that can be
 * ticked on screen (a form field) or on paper.
 */
export async function createMissingListPdf(input: MissingListPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(input.title)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const form = pdf.getForm()
  const ink = rgb(0.1, 0.1, 0.12)
  const faint = rgb(0.45, 0.45, 0.5)
  const pages: PDFPage[] = []
  const columns = hasSeveralLanguages(input.rows) ? COLUMNS_WITH_LANGUAGE : COLUMNS

  function addPage(): { page: PDFPage; y: number } {
    const page = pdf.addPage([PAGE.width, PAGE.height])
    pages.push(page)
    let y = PAGE.height - PAGE.margin
    if (pages.length === 1) {
      page.drawText(fitted(input.title, bold, 16, PAGE.width - 2 * PAGE.margin), {
        x: PAGE.margin,
        y: y - 16,
        size: 16,
        font: bold,
        color: ink,
      })
      page.drawText(printable(input.subtitle, font), {
        x: PAGE.margin,
        y: y - 34,
        size: 10,
        font,
        color: faint,
      })
      y -= 56
    }
    if (input.rows.length > 0) {
      for (const column of columns) {
        page.drawText(fitted(input.columns[column.key], bold, FONT_SIZE, column.width), {
          x: column.x,
          y: y - FONT_SIZE,
          size: FONT_SIZE,
          font: bold,
          color: ink,
        })
      }
      y -= ROW_HEIGHT
      page.drawLine({
        start: { x: PAGE.margin, y: y + 4 },
        end: { x: PAGE.width - PAGE.margin, y: y + 4 },
        thickness: 0.5,
        color: faint,
      })
    }
    return { page, y }
  }

  let { page, y } = addPage()
  if (input.rows.length === 0) {
    page.drawText(printable(input.emptyText, font), { x: PAGE.margin, y: y - 12, size: 11, font, color: ink })
  }

  input.rows.forEach((row, index) => {
    if (y - ROW_HEIGHT < PAGE.margin + 20) ({ page, y } = addPage())
    const top = y - ROW_HEIGHT
    form.createCheckBox(checkboxName(index, row)).addToPage(page, {
      x: PAGE.margin,
      y: top + (ROW_HEIGHT - BOX) / 2,
      width: BOX,
      height: BOX,
      borderWidth: 1,
      borderColor: ink,
      backgroundColor: rgb(1, 1, 1),
    })
    const cells: Record<ColumnKey, string> = {
      set: readable(row.setName, row.setId, font),
      lang: input.languageLabel(row.lang),
      number: row.number,
      name: readable(row.name, row.cardId, font),
      variant: input.variantLabel(row.variant),
      rarity: row.rarity,
    }
    for (const column of columns) {
      page.drawText(fitted(cells[column.key], font, FONT_SIZE, column.width), {
        x: column.x,
        y: top + (ROW_HEIGHT - FONT_SIZE) / 2 + 1,
        size: FONT_SIZE,
        font,
        color: ink,
      })
    }
    y = top
  })

  pages.forEach((entry, index) => {
    const label = printable(input.pageLabel(index + 1, pages.length), font)
    entry.drawText(label, {
      x: PAGE.width - PAGE.margin - font.widthOfTextAtSize(label, 8),
      y: PAGE.margin - 14,
      size: 8,
      font,
      color: faint,
    })
  })

  return pdf.save()
}
