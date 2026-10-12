// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder } from '../../types/binder'
import { addPage, createBinder, setCard, setCardLang, setOwned } from '../binder/binderModel'
import {
  buildMissingList,
  hasSeveralLanguages,
  missingListCsv,
  totalPrice,
  type CardInfo,
  type CsvLabels,
  type MissingRow,
} from './missingList'
import { checkboxName, createMissingListPdf, type MissingListPdfInput } from './missingListPdf'
import { missingListFileName, proxyFileName } from './missingListTransfer'

const infos: Record<string, CardInfo> = {
  'sv03.5-025': { name: 'Pikachu', localId: '025', setId: 'sv03.5', setName: '151', officialCount: 165, rarity: 'Häufig' },
  'sv03.5-006': { name: 'Glurak-ex', localId: '006', setId: 'sv03.5', setName: '151', officialCount: 165, rarity: 'Doppelselten' },
  'sv03.5-173': { name: 'Pikachu', localId: '173', setId: 'sv03.5', setName: '151', officialCount: 165 },
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
      lang: 'de',
      setId: 'sv03.5',
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
      lang: 'de',
      setId: '',
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
    columns: {
      set: 'Set',
      lang: 'Spr.',
      number: 'Nummer',
      name: 'Name',
      variant: 'Variante',
      rarity: 'Seltenheit',
      price: 'Preis',
    },
    rows,
    variantLabel: (variant) => variant,
    languageLabel: (lang) => lang.toUpperCase(),
    priceLabel: (amount) => `${amount.toFixed(2)} €`,
    totalLabel: (amount, unpriced) => `Summe: ${amount.toFixed(2)} € (${unpriced} ohne Preis)`,
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
    const row = (cardId: string, values: Partial<MissingRow>): MissingRow => ({
      cardId,
      variant: 'normal',
      lang: 'de',
      setId: 'x',
      setName: 'Set',
      number: '1',
      name: 'Name',
      rarity: '',
      page: 1,
      ...values,
    })
    const rows = [
      row('base1-29', { setName: 'Grundset', number: '29/102', name: 'Nidoran♀', rarity: 'Häufig' }),
      row('x-1', { name: 'Pokémon δ – Größe' }),
      row('x-2', { setName: 'S'.repeat(200), name: 'N'.repeat(200), rarity: 'R'.repeat(200) }),
    ]

    const bytes = await createMissingListPdf(pdfInput(rows))

    expect(await fieldNames(bytes)).toHaveLength(3)
  })

  it('lists cards of several languages, Japanese ones by their ids', async () => {
    const binder = buildBinder()
    const first = binder.pages[0]
    if (!first) throw new Error('Expected a page')
    const mixed = setCard(binder, { pageId: first.id, slotIndex: 7 }, { cardId: 'SV2a-006', lang: 'ja', variant: 'holo' }, false)
    const rows = buildMissingList(mixed, (cardId, lang) =>
      lang === 'ja'
        ? { name: 'リザードンex', localId: '006', setId: 'SV2a', setName: 'ポケモンカード151', officialCount: 165 }
        : lookup(cardId),
    )

    expect(hasSeveralLanguages(rows)).toBe(true)
    expect(hasSeveralLanguages(rows.filter((entry) => entry.lang === 'de'))).toBe(false)
    expect(rows.find((entry) => entry.lang === 'ja')).toMatchObject({
      cardId: 'SV2a-006',
      setId: 'SV2a',
      name: 'リザードンex',
      number: '006/165',
    })

    const bytes = await createMissingListPdf(pdfInput(rows))

    expect(await fieldNames(bytes)).toContain('fehlt_3_SV2a-006_holo')
  })

  it('asks for each card in its own language', () => {
    const binder = buildBinder()
    const first = binder.pages[0]
    if (!first) throw new Error('Expected a page')
    const english = setCardLang(binder, { pageId: first.id, slotIndex: 1 }, 'en')
    const asked: string[] = []

    buildMissingList(english, (cardId, lang) => {
      asked.push(`${lang}:${cardId}`)
      return undefined
    })

    expect(asked).toEqual(['en:sv03.5-025', 'de:sv03.5-006', 'de:svp-050', 'de:mystery-7'])
  })

  it('says so when nothing is missing', async () => {
    const bytes = await createMissingListPdf(pdfInput([]))

    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getForm().getFields()).toEqual([])
  })
})

describe('prices in the list', () => {
  const prices: Record<string, number> = {
    'sv03.5-025/reverse': 0.63,
    'sv03.5-006/holo': 12.5,
    'svp-050/holo': 1.99,
  }
  const priceOf = (cardId: string, variant: string) => prices[`${cardId}/${variant}`]

  it('gives each missing card the price of its own finish', () => {
    const rows = buildMissingList(buildBinder(), lookup, priceOf)

    expect(rows.map((row) => row.price)).toEqual([0.63, 12.5, 1.99, undefined])
    // without a price there is no such field at all
    expect(rows[3]).not.toHaveProperty('price')
  })

  it('adds the prices up and counts the cards without one', () => {
    const rows = buildMissingList(buildBinder(), lookup, priceOf)

    expect(totalPrice(rows)).toEqual({ total: 15.12, unpriced: 1 })
    expect(totalPrice([])).toEqual({ total: 0, unpriced: 0 })
  })

  it('does not drift when many small amounts are added', () => {
    const rows = Array.from({ length: 1000 }, () => ({ price: 0.1 }))

    expect(totalPrice(rows).total).toBe(100)
  })

  it('puts price column and sum into the PDF without disturbing the boxes', async () => {
    const rows = buildMissingList(buildBinder(), lookup, priceOf)
    const columns = { set: 'Set', lang: 'Spr.', number: 'Nummer', name: 'Name', variant: 'Variante', rarity: 'Seltenheit', price: 'Preis' }
    const labels: string[] = []

    const bytes = await createMissingListPdf({
      title: 'Fehlliste',
      subtitle: '',
      emptyText: '',
      columns,
      rows,
      variantLabel: (variant) => variant,
      languageLabel: (lang) => lang,
      priceLabel: (amount) => {
        labels.push(amount.toFixed(2))
        return `${amount.toFixed(2)} €`
      },
      totalLabel: (amount, unpriced) => {
        labels.push(`total ${amount.toFixed(2)} / ${unpriced}`)
        return `Summe: ${amount.toFixed(2)} €`
      },
      pageLabel: () => '',
    })

    expect(labels).toEqual(['0.63', '12.50', '1.99', 'total 15.12 / 1'])
    expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(4)
  })
})

describe('missingListCsv', () => {
  const labels: CsvLabels = {
    columns: {
      set: 'Set',
      number: 'Nummer',
      name: 'Name',
      variant: 'Variante',
      rarity: 'Seltenheit',
      lang: 'Sprache',
      page: 'Binder-Seite',
      price: 'Preis (EUR)',
    },
    total: 'Summe',
    variantLabel: (variant) => (variant === 'reverse' ? 'Reverse Holo' : variant),
    languageLabel: (lang) => (lang === 'de' ? 'Deutsch' : lang),
  }
  const priceOf = (cardId: string) => (cardId === 'sv03.5-006' ? 1234.5 : cardId === 'sv03.5-025' ? 0.63 : undefined)

  it('writes one line per missing card, in a form a German Excel opens by double click', () => {
    const csv = missingListCsv(buildMissingList(buildBinder(), lookup, priceOf), labels)

    // byte order mark first, so that umlauts survive; Windows line ends; semicolons
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toEqual([
      'Set;Nummer;Name;Variante;Seltenheit;Sprache;Binder-Seite;Preis (EUR)',
      '151;"=""025/165""";Pikachu;Reverse Holo;Häufig;Deutsch;1;0,63',
      '151;"=""006/165""";Glurak-ex;holo;Doppelselten;Deutsch;1;1234,50',
      ';"=""050""";Simsala-ex;holo;Promo;Deutsch;2;',
      ';;mystery-7;normal;;Deutsch;2;',
      'Summe;;;;;;;1235,13',
      '',
    ])
  })

  it('keeps numbers like 025/165 as text, so Excel does not read a date into them', () => {
    const csv = missingListCsv(buildMissingList(buildBinder(), lookup), labels)

    expect(csv).toContain('"=""025/165"""')
    // without any price there is no line for the sum
    expect(csv).not.toContain('Summe')
  })

  it('quotes fields that contain semicolons, quotes or line breaks', () => {
    const rows = buildMissingList(buildBinder(), () => ({ name: 'Pikachu; "der Starke"', localId: '1', setName: 'Zeile\nzwei' }))

    const csv = missingListCsv(rows.slice(0, 1), labels)

    expect(csv).toContain('"Zeile\nzwei";"=""1""";"Pikachu; ""der Starke"""')
  })

  it('consists of the header alone when nothing is missing', () => {
    expect(missingListCsv([], labels).slice(1)).toBe(
      'Set;Nummer;Name;Variante;Seltenheit;Sprache;Binder-Seite;Preis (EUR)\r\n',
    )
  })
})

describe('file names', () => {
  it('names the table and the placeholders after binder and date too', () => {
    expect(missingListFileName('Kanto Collection', '2026-10-12T10:00:00.000Z', 'csv')).toBe(
      'fehlende-karten-kanto-collection-2026-10-12.csv',
    )
    expect(proxyFileName('Kanto Collection', '2026-10-12T10:00:00.000Z')).toBe(
      'platzhalter-kanto-collection-2026-10-12.pdf',
    )
  })
})

describe('missingListFileName', () => {
  it('builds a file name from binder name and date', () => {
    expect(missingListFileName('Kanto Collection', '2026-10-12T10:00:00.000Z')).toBe(
      'fehlende-karten-kanto-collection-2026-10-12.pdf',
    )
    expect(missingListFileName('!!', '2026-01-02T00:00:00.000Z')).toBe('fehlende-karten-binder-2026-01-02.pdf')
  })
})
