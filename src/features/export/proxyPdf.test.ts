// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  cardRect,
  CARDS_PER_SHEET,
  createProxyPdf,
  cutMarks,
  mm,
  sheetsNeeded,
  type ProxyCard,
} from './proxyPdf'

/** Points back to millimetres, rounded to a hundredth. */
const toMm = (points: number) => Math.round((points * 25.4 * 100) / 72) / 100

/** A 1 × 1 pixel grey JPEG. */
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  ),
  (char) => char.charCodeAt(0),
)

const card = (index: number, withPicture = false): ProxyCard => ({
  name: `Karte ${index}`,
  number: `${String(index).padStart(3, '0')}/165`,
  ...(withPicture ? { jpeg: JPEG } : {}),
})

describe('card positions', () => {
  it('makes every card exactly 63 × 88 mm', () => {
    for (let position = 0; position < CARDS_PER_SHEET; position++) {
      const rect = cardRect(position)
      expect(toMm(rect.width)).toBe(63)
      expect(toMm(rect.height)).toBe(88)
    }
  })

  it('puts 3 × 3 cards edge to edge in the middle of an A4 sheet', () => {
    const first = cardRect(0)
    const last = cardRect(8)

    // the block is 189 × 264 mm, leaving 10.5 mm at the sides and 16.5 mm above and below
    expect(toMm(first.x)).toBe(10.5)
    expect(toMm(last.x + last.width)).toBe(199.5)
    expect(toMm(first.y + first.height)).toBe(280.5)
    expect(toMm(last.y)).toBe(16.5)
    expect(toMm(cardRect(1).x)).toBe(toMm(first.x + first.width))
    expect(toMm(cardRect(3).y + cardRect(3).height)).toBe(toMm(first.y))
  })

  it('runs left to right, top to bottom, like the pockets of a binder page', () => {
    const column = (position: number) => Math.round(toMm(cardRect(position).x - cardRect(0).x) / 63)
    const row = (position: number) => Math.round(toMm(cardRect(0).y - cardRect(position).y) / 88)

    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(column)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2])
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(row)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2])
  })
})

describe('cutMarks', () => {
  const marks = cutMarks()

  it('marks all four vertical and four horizontal cuts at both ends', () => {
    expect(marks).toHaveLength(16)
    const vertical = marks.filter((mark) => mark.from.x === mark.to.x)
    const horizontal = marks.filter((mark) => mark.from.y === mark.to.y)

    expect([...new Set(vertical.map((mark) => toMm(mark.from.x)))].sort((a, b) => a - b)).toEqual([
      10.5, 73.5, 136.5, 199.5,
    ])
    expect([...new Set(horizontal.map((mark) => toMm(mark.from.y)))].sort((a, b) => a - b)).toEqual([
      16.5, 104.5, 192.5, 280.5,
    ])
  })

  it('stays outside the cards and on the sheet', () => {
    for (const mark of marks) {
      for (const point of [mark.from, mark.to]) {
        const inside =
          point.x > mm(10.5) && point.x < mm(199.5) && point.y > mm(16.5) && point.y < mm(280.5)
        expect(inside).toBe(false)
        expect(point.x).toBeGreaterThan(0)
        expect(point.x).toBeLessThan(mm(210))
        expect(point.y).toBeGreaterThan(0)
        expect(point.y).toBeLessThan(mm(297))
      }
    }
  })
})

describe('createProxyPdf', () => {
  const input = (cards: ProxyCard[]) => ({
    title: 'Platzhalter – Kanto Collection',
    footer: (sheet: number, sheetCount: number) => `Blatt ${sheet} von ${sheetCount}`,
    cards,
  })

  it('needs one sheet for every nine cards', () => {
    expect(sheetsNeeded(0)).toBe(0)
    expect(sheetsNeeded(9)).toBe(1)
    expect(sheetsNeeded(10)).toBe(2)
    expect(sheetsNeeded(357)).toBe(40)
  })

  it('creates A4 sheets with pictures and with framed placeholders', async () => {
    const cards = Array.from({ length: 20 }, (_, index) => card(index + 1, index % 2 === 0))

    const pdf = await PDFDocument.load(await createProxyPdf(input(cards)))

    expect(pdf.getTitle()).toBe('Platzhalter – Kanto Collection')
    expect(pdf.getPageCount()).toBe(3)
    for (const page of pdf.getPages()) {
      expect(toMm(page.getWidth())).toBe(210)
      expect(toMm(page.getHeight())).toBe(297)
    }
  })

  it('stores a picture once when several cards share it', async () => {
    const shared = Array.from({ length: 18 }, (_, index) => ({ ...card(index, true), imageKey: 'de:sv03.5-001' }))
    const separate = Array.from({ length: 18 }, (_, index) => card(index, true))

    const sharedSize = (await createProxyPdf(input(shared))).length
    const separateSize = (await createProxyPdf(input(separate))).length

    // 18 cards, one picture: the file grows by the frames, not by 17 more pictures
    expect(separateSize - sharedSize).toBeGreaterThan(17 * 100)
    expect((await PDFDocument.load(await createProxyPdf(input(shared)))).getPageCount()).toBe(2)
  })

  it('copes with names the PDF font cannot write and with very long ones', async () => {
    const cards: ProxyCard[] = [
      { name: 'リザードンex', number: '006/165' },
      { name: 'N'.repeat(300), number: '' },
      { name: 'Nidoran♀', number: '29/102' },
    ]

    const pdf = await PDFDocument.load(await createProxyPdf(input(cards)))

    expect(pdf.getPageCount()).toBe(1)
  })

  it('still gives a valid, empty document when nothing is missing', async () => {
    const pdf = await PDFDocument.load(await createProxyPdf(input([])))

    expect(pdf.getPageCount()).toBe(1)
  })
})
