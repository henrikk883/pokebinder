// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { addPage, createBinder, setCard, setOwned } from '../binder/binderModel'
import { buildMissingList, type CardInfo, type MissingRow } from './missingList'
import { checkboxName, createMissingListPdf, type MissingListPdfInput } from './missingListPdf'
import { missingListFileName } from './missingListTransfer'

const infos: Record<string, CardInfo> = {
  'sv03.5-025': { name: 'Pikachu', localId: '025', setName: '151', officialCount: 165, rarity: 'Häufig' },
  'sv03.5-006': { name: 'Glurak-ex', localId: '006', setName: '151', officialCount: 165, rarity: 'Doppelselten' },
  'sv03.5-173': { name: 'Pikachu', localId: '173', setName: '151', officialCount: 165 },
  'svp-050': { name: 'Simsala-ex', localId: '050', rarity: 'Promo' },
}
const lookup = (cardId: string) => infos[cardId]

function buildBinder(): Binder {
  const ctx = createTestContext()
  let binder = addPage(createBinder({ name: 'Kanto Collection' }, ctx), ctx)
  const [first, second] = binder.pages
  if (!first || !second) throw new Error('Expected two pages')
  const place = (pageId: string, slotIndex: number, cardId: string, variant: string, owned: boolean) => {
    binder = setCard(binder, { pageId, slotIndex }, { cardId, lang: 'de', variant }, owned, ctx)
  }
  place(first.id, 0, 'sv03.5-025', 'normal', true)
  place(first.id, 1, 'sv03.5-025', 'reverse', false)
  place(first.id, 5, 'sv03.5-006', 'holo', false)
  place(second.id, 2, 'sv03.5-173', 'normal', true)
  place(second.id, 3, 'svp-050', 'holo', false)
  place(second.id, 8, 'mystery-7', 'normal', false)
  return binder
}

describe('buildMissingList', () => {
  it('lists exactly the cards marked as missing, in binder order', () => {
    const rows = buildMissingList(buildBinder(), lookup)

    expect(rows.map((row) => `${row.cardId}/${row.variant}`)).toEqual([
      'sv03.5-025/reverse',
      'sv03.5-006/holo',
      'svp-050/holo',
      'mystery-7/normal',
    ])
  })

  it('gives set, number, name, variant, rarity and page for each card', () => {
    const [pikachu, glurak] = buildMissingList(buildBinder(), lookup)

    expect(pikachu).toEqual({
      cardId: 'sv03.5-025',
      variant: 'reverse',
      setName: '151',
      number: '025/165',
      name: 'Pikachu',
      rarity: 'Häufig',
      page: 1,
    })
    expect(glurak).toMatchObject({ number: '006/165', name: 'Glurak-ex', rarity: 'Doppelselten', variant: 'holo' })
  })

  it('copes with cards TCGdex knows little or nothing about', () => {
    const rows = buildMissingList(buildBinder(), lookup)

    expect(rows[2]).toEqual({
      cardId: 'svp-050',
      variant: 'holo',
      setName: '',
      number: '050',
      name: 'Simsala-ex',
      rarity: 'Promo',
      page: 2,
    })
    expect(rows[3]).toMatchObject({ cardId: 'mystery-7', name: 'mystery-7', number: '', setName: '', rarity: '' })
  })

  it('follows the markings: a card that is found disappears, one that is lost appears', () => {
    const binder = buildBinder()
    const [first, second] = binder.pages
    if (!first || !second) throw new Error('Expected two pages')

    let changed = setOwned(binder, { pageId: first.id, slotIndex: 1 }, true)
    changed = setOwned(changed, { pageId: second.id, slotIndex: 2 }, false)

    expect(buildMissingList(changed, lookup).map((row) => `${row.cardId}/${row.variant}`)).toEqual([
      'sv03.5-006/holo',
      'sv03.5-173/normal',
      'svp-050/holo',
      'mystery-7/normal',
    ])
  })

  it('is empty for a complete binder and for one without cards', () => {
    const ctx = createTestContext()
    const empty = createBinder({ name: 'Leer' }, ctx)
    const complete = setCard(
      empty,
      { pageId: empty.pages[0]?.id ?? '', slotIndex: 0 },
      { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' },
      true,
      ctx,
    )

    expect(buildMissingList(empty, lookup)).toEqual([])
    expect(buildMissingList(complete, lookup)).toEqual([])
  })
})

describe('createMissingListPdf', () => {
  const pdfInput = (rows: MissingRow[]): MissingListPdfInput => ({
    title: 'Fehlliste – Kanto Collection',
    subtitle: `${rows.length} fehlende Karten · Stand 12.10.2026`,
    emptyText: 'Es fehlt keine Karte.',
    columns: { set: 'Set', number: 'Nummer', name: 'Name', variant: 'Variante', rarity: 'Seltenheit' },
    rows,
    variantLabel: (variant) => variant,
    pageLabel: (page, pageCount) => `Seite ${page} von ${pageCount}`,
  })

  async function fieldNames(bytes: Uint8Array): Promise<string[]> {
    const pdf = await PDFDocument.load(bytes)
    return pdf.getForm().getFields().map((field) => field.getName())
  }

  it('has one tickable box per missing card, named after the card', async () => {
    const rows = buildMissingList(buildBinder(), lookup)

    const bytes = await createMissingListPdf(pdfInput(rows))

    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getTitle()).toBe('Fehlliste – Kanto Collection')
    expect(pdf.getPageCount()).toBe(1)
    const form = pdf.getForm()
    expect(form.getFields().map((field) => field.getName())).toEqual([
      'fehlt_1_sv03.5-025_reverse',
      'fehlt_2_sv03.5-006_holo',
      'fehlt_3_svp-050_holo',
      'fehlt_4_mystery-7_normal',
    ])
    expect(rows.map((row, index) => checkboxName(index, row))).toEqual(await fieldNames(bytes))

    // the boxes really can be ticked, and start empty
    const box = form.getCheckBox('fehlt_1_sv03.5-025_reverse')
    expect(box.isChecked()).toBe(false)
    box.check()
    expect(box.isChecked()).toBe(true)
  })

  it('continues on further pages for a long list', async () => {
    const row = buildMissingList(buildBinder(), lookup)[0]
    if (!row) throw new Error('Expected a row')
    const rows = Array.from({ length: 150 }, (_, index) => ({ ...row, cardId: `sv03.5-${index + 1}` }))

    const bytes = await createMissingListPdf(pdfInput(rows))

    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(2)
    expect(pdf.getForm().getFields()).toHaveLength(150)
    // every page has the A4 format for printing
    expect(pdf.getPages().every((page) => Math.round(page.getWidth()) === 595 && Math.round(page.getHeight()) === 842)).toBe(true)
  })

  it('writes names with letters the PDF font does not have, and very long ones', async () => {
    const rows: MissingRow[] = [
      { cardId: 'base1-29', variant: 'normal', setName: 'Grundset', number: '29/102', name: 'Nidoran♀', rarity: 'Häufig', page: 1 },
      { cardId: 'x-1', variant: 'normal', setName: 'ポケモン', number: '1', name: 'Pokémon δ – Größe', rarity: '', page: 1 },
      { cardId: 'x-2', variant: 'normal', setName: 'S'.repeat(200), number: '2', name: 'N'.repeat(200), rarity: 'R'.repeat(200), page: 1 },
    ]

    const bytes = await createMissingListPdf(pdfInput(rows))

    expect(await fieldNames(bytes)).toHaveLength(3)
  })

  it('says so when nothing is missing', async () => {
    const bytes = await createMissingListPdf(pdfInput([]))

    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getForm().getFields()).toEqual([])
  })
})

describe('missingListFileName', () => {
  it('builds a file name from binder name and date', () => {
    expect(missingListFileName('Kanto Collection', '2026-10-12T10:00:00.000Z')).toBe(
      'fehlliste-kanto-collection-2026-10-12.pdf',
    )
    expect(missingListFileName('!!', '2026-01-02T00:00:00.000Z')).toBe('fehlliste-binder-2026-01-02.pdf')
  })
})
