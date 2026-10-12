// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createMissingListPdf } from './missingListPdf'
import type { MissingRow } from './missingList'
import { embedFonts, fontFor, needsWideFont, printable } from './pdfText'
import { createProxyPdf } from './proxyPdf'

/** The font the app ships for Japanese. */
const wideFontFile = async () => new Uint8Array(await readFile('public/fonts/NotoSansJP-Regular.ttf'))

describe('needsWideFont', () => {
  it('is needed for kana, kanji and the punctuation that comes with them', () => {
    expect(needsWideFont('リザードンex')).toBe(true)
    expect(needsWideFont('博士の研究')).toBe(true)
    expect(needsWideFont('ポケモンカード151')).toBe(true)
    expect(needsWideFont('「ex」')).toBe(true)
  })

  it('is not needed for German and English names, whatever their accents and signs', () => {
    expect(needsWideFont('Glurak-ex')).toBe(false)
    expect(needsWideFont('Pokémon δ – Größe')).toBe(false)
    expect(needsWideFont('Nidoran♀ ★')).toBe(false)
    expect(needsWideFont('')).toBe(false)
  })
})

describe('fonts of a PDF', () => {
  it('writes Japanese with the wide font and everything else with the usual one', async () => {
    const pdf = await PDFDocument.create()
    const fonts = await embedFonts(pdf, await wideFontFile())

    expect(fonts.wide).toBeDefined()
    expect(fontFor('リザードンex', fonts.regular, fonts)).toBe(fonts.wide)
    expect(fontFor('Glurak-ex', fonts.regular, fonts)).toBe(fonts.regular)
    expect(fontFor('Glurak-ex', fonts.bold, fonts)).toBe(fonts.bold)
    // the wide font knows the Latin letters in such names too
    if (!fonts.wide) throw new Error('Expected the wide font')
    expect(printable('ピカチュウ & ゼクロムGX 151', fonts.wide)).toBe('ピカチュウ & ゼクロムGX 151')
    expect(printable('博士の研究（オーキド博士）', fonts.wide)).toBe('博士の研究（オーキド博士）')
  })

  it('has no wide font unless one is handed in, and then replaces what it cannot write', async () => {
    const pdf = await PDFDocument.create()
    const fonts = await embedFonts(pdf)

    expect(fonts.wide).toBeUndefined()
    expect(fontFor('リザードンex', fonts.regular, fonts)).toBe(fonts.regular)
    expect(printable('リザードンex', fonts.regular)).toBe('?????ex')
    expect(printable('Nidoran♀', fonts.regular)).toBe('Nidoran (w)')
    expect(printable('Größe é', fonts.regular)).toBe('Größe é')
  })
})

describe('Japanese names in the exports', () => {
  const row: MissingRow = {
    page: 1,
    cardId: 'SV2a-006',
    lang: 'ja',
    variant: 'holo',
    setId: 'SV2a',
    setName: 'ポケモンカード151',
    number: '006/165',
    name: 'リザードンex',
    rarity: 'Double rare',
  }
  const listInput = (wideFont?: Uint8Array) => ({
    title: 'Fehlliste – 日本',
    subtitle: '1 Karte',
    emptyText: '',
    columns: { set: 'Set', lang: 'Spr.', number: 'Nr.', name: 'Name', variant: 'Variante', rarity: 'Seltenheit', price: 'Preis' },
    rows: [row],
    variantLabel: (variant: string) => variant,
    languageLabel: (lang: string) => lang.toUpperCase(),
    priceLabel: (amount: number) => `${amount} €`,
    totalLabel: (amount: number) => `Summe ${amount}`,
    pageLabel: (page: number, pageCount: number) => `${page} / ${pageCount}`,
    ...(wideFont ? { wideFont } : {}),
  })

  it('embeds the font in the checklist only when it is handed in', async () => {
    const without = await createMissingListPdf(listInput())
    const withFont = await createMissingListPdf(listInput(await wideFontFile()))

    expect(without.length).toBeLessThan(100_000)
    // the whole font travels with the file
    expect(withFont.length).toBeGreaterThan(1_000_000)
    const pdf = await PDFDocument.load(withFont)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual(['fehlt_1_SV2a-006_holo'])
  })

  it('does the same for the placeholder of a card without a picture', async () => {
    const input = (wideFont?: Uint8Array) => ({
      title: 'Platzhalter',
      footer: () => 'Bei 100 % drucken',
      cards: [{ name: 'リザードンex', number: '006/165' }],
      ...(wideFont ? { wideFont } : {}),
    })

    const without = await createProxyPdf(input())
    const withFont = await createProxyPdf(input(await wideFontFile()))

    expect(without.length).toBeLessThan(100_000)
    expect(withFont.length).toBeGreaterThan(1_000_000)
    expect((await PDFDocument.load(withFont)).getPageCount()).toBe(1)
  })
})
