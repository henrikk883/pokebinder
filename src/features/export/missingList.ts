import type { Binder, CardLang, CardVariant } from '../../types/binder'

/** What the list needs to know about a card; comes from TCGdex. */
export interface CardInfo {
  name: string
  localId: string
  setId?: string
  setName?: string
  officialCount?: number
  rarity?: string
}

export interface MissingRow {
  cardId: string
  variant: CardVariant
  lang: CardLang
  /** Empty when the set is unknown. */
  setId: string
  setName: string
  /** Number as printed on the card, e.g. `025/165`. */
  number: string
  name: string
  /** Empty when TCGdex has no rarity for the card. */
  rarity: string
  /** Page of the binder the card belongs on, starting at 1. */
  page: number
  /** Cardmarket price in euros; missing when prices were not loaded or there is none. */
  price?: number
}

export type PriceLookup = (cardId: string, variant: CardVariant, lang: CardLang) => number | undefined

/**
 * Every card of the binder that is marked as missing, in binder order. A card that sits
 * in several pockets (e.g. normal and reverse) gets one row per pocket.
 */
export function buildMissingList(
  binder: Binder,
  lookup: (cardId: string, lang: CardLang) => CardInfo | undefined,
  priceOf: PriceLookup = () => undefined,
): MissingRow[] {
  const rows: MissingRow[] = []
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (!slot.cardRef || slot.owned) continue
      const { cardId, variant, lang } = slot.cardRef
      const info = lookup(cardId, lang)
      const price = priceOf(cardId, variant, lang)
      rows.push({
        ...(price === undefined ? {} : { price }),
        cardId,
        variant,
        lang,
        setId: info?.setId ?? '',
        setName: info?.setName ?? '',
        number: info
          ? info.officialCount === undefined
            ? info.localId
            : `${info.localId}/${info.officialCount}`
          : '',
        // without data from TCGdex the id is all there is to identify the card
        name: info?.name ?? cardId,
        rarity: info?.rarity ?? '',
        page: page.index + 1,
      })
    }
  }
  return rows
}

export interface PriceTotal {
  /** Sum of the known prices, in euros. */
  total: number
  /** Rows without a price; the sum is that much too low. */
  unpriced: number
}

export function totalPrice(rows: readonly Pick<MissingRow, 'price'>[]): PriceTotal {
  let cents = 0
  let unpriced = 0
  for (const row of rows) {
    if (row.price === undefined) unpriced++
    else cents += Math.round(row.price * 100)
  }
  return { total: cents / 100, unpriced }
}

export interface CsvLabels {
  columns: { set: string; number: string; name: string; variant: string; rarity: string; lang: string; page: string; price: string }
  total: string
  variantLabel: (variant: CardVariant) => string
  languageLabel: (lang: CardLang) => string
}

/** For a table cell: `1234,50`, a number Excel can calculate with. */
function plainEuro(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

/** Tells Excel that the file is UTF-8, so that umlauts arrive intact. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * The list of missing cards as a table for Excel: semicolons between the columns, decimal
 * commas and a byte order mark, which is what a German Excel opens correctly by double click.
 */
export function missingListCsv(rows: readonly MissingRow[], labels: CsvLabels): string {
  const { columns } = labels
  const lines = [
    [columns.set, columns.number, columns.name, columns.variant, columns.rarity, columns.lang, columns.page, columns.price],
    ...rows.map((row) => [
      row.setName || row.setId,
      // kept as text: Excel would turn "025/165" into a date or a fraction
      row.number === '' ? '' : `="${row.number}"`,
      row.name,
      labels.variantLabel(row.variant),
      row.rarity,
      labels.languageLabel(row.lang),
      String(row.page),
      row.price === undefined ? '' : plainEuro(row.price),
    ]),
  ]
  const { total } = totalPrice(rows)
  if (rows.some((row) => row.price !== undefined)) {
    lines.push([labels.total, '', '', '', '', '', '', plainEuro(total)])
  }
  return `${BYTE_ORDER_MARK}${lines.map((line) => line.map(csvField).join(';')).join('\r\n')}\r\n`
}

/** Whether the list needs to say which language each card is in. */
export function hasSeveralLanguages(rows: readonly MissingRow[]): boolean {
  return new Set(rows.map((row) => row.lang)).size > 1
}
