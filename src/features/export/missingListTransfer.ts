import { cardmarketCardOf, cardmarketLines, type RawListedCard } from './cardmarketList'
import { de } from '../../i18n/de'
import {
  cardImageSources,
  mapWithConcurrency,
  setIdOfCardId,
  tcgdexFor,
  readPicture,
} from '../../lib/tcgdex'
import type { Binder, CardLang } from '../../types/binder'
import { copiesOf } from '../binder/binderModel'
import { buildMissingList, missingListCsv, type CardInfo, type MissingRow } from './missingList'
import { createMissingListPdf } from './missingListPdf'
import { wideFontFor } from './pdfFont'
import { createProxyPdf, type ProxyCard } from './proxyPdf'
import type { ShoppingRow } from './shopping'

/** Requests to TCGdex running at the same time while a list is put together. */
const PARALLEL_REQUESTS = 8

/** Good enough for a placeholder, and it keeps the file of a whole master set manageable. */
const PROXY_JPEG_QUALITY = 0.8

export type Progress =(done: number, total: number) => void

const cardKey = (cardId: string, lang: CardLang) => `${lang}:${cardId}`
const priceKey = (row: Pick<MissingRow, 'cardId' | 'variant' | 'lang'>) =>
  `${row.lang}:${row.cardId}:${row.variant}`

interface LoadedCard extends CardInfo {
  /** Addresses of pictures to try, best first: the card's own language, then English stand-ins. */
  images: string[]
}

async function loadCard(cardId: string, lang: CardLang): Promise<LoadedCard | undefined> {
  const client = tcgdexFor(lang)
  const detail = await client.getCardDetail(cardId).catch(() => undefined)
  if (!detail) return undefined
  const { setsById } = await client.getCatalog()
  const set = setsById.get(setIdOfCardId(cardId, setsById) ?? '')
  const { own, substitutes } = cardImageSources(detail, set, 'large')
  const card: LoadedCard = {
    name: detail.name,
    localId: detail.localId,
    // every picture is fetched here and judged by the status of the answer
    images: own ? [own] : substitutes.map((substitute) => substitute.url),
  }
  if (set) {
    card.setId = set.id
    card.setName = set.name
    card.officialCount = set.cardCount.official
  }
  if (detail.rarity) card.rarity = detail.rarity
  return card
}

interface LoadedList {
  rows: MissingRow[]
  cards: Map<string, LoadedCard>
  /** Cardmarket's product number of each priced card and finish. */
  products: Map<string, number>
}

/**
 * The missing cards of a binder with name, number, set, rarity and Cardmarket price, as
 * far as TCGdex has them. Prices need a request per card; `onProgress` reports how far
 * that is.
 */
async function loadList(binder: Binder, withPrices: boolean, onProgress?: Progress): Promise<LoadedList> {
  const missing = buildMissingList(binder, () => undefined)
  const cards = new Map<string, LoadedCard>()
  const wanted = [...new Map(missing.map((row) => [cardKey(row.cardId, row.lang), row])).values()]
  await Promise.all(
    wanted.map(async ({ cardId, lang }) => {
      const card = await loadCard(cardId, lang)
      if (card) cards.set(cardKey(cardId, lang), card)
    }),
  )

  const prices = new Map<string, number>()
  const products = new Map<string, number>()
  if (withPrices) {
    const priced = [...new Map(missing.map((row) => [priceKey(row), row])).values()]
    await mapWithConcurrency(
      priced,
      PARALLEL_REQUESTS,
      async (row) => {
        const price = await tcgdexFor(row.lang)
          .getPrice(row.cardId, row.variant)
          .catch(() => undefined)
        if (price) prices.set(priceKey(row), price.amount)
        if (price?.productId !== undefined) products.set(priceKey(row), price.productId)
      },
      onProgress,
    )
  }

  const rows = buildMissingList(
    binder,
    (cardId, lang) => cards.get(cardKey(cardId, lang)),
    (cardId, variant, lang) => prices.get(priceKey({ cardId, variant, lang })),
  )
  return { rows, cards, products }
}

export async function loadMissingList(binder: Binder, onProgress?: Progress): Promise<MissingRow[]> {
  return (await loadList(binder, true, onProgress)).rows
}

/**
 * The cards of a binder there are more than one copy of, as lines of a list to trade
 * from: each with the copies beyond the one the binder holds, and what one is worth.
 */
export async function loadTradeRows(binder: Binder, onProgress?: Progress): Promise<ShoppingRow[]> {
  const spare = binder.pages.flatMap((page) =>
    page.slots.flatMap((slot) => {
      const extra = copiesOf(slot) - 1
      return slot.cardRef && extra > 0 ? [{ cardRef: slot.cardRef, extra }] : []
    }),
  )
  return mapWithConcurrency(
    spare,
    PARALLEL_REQUESTS,
    async ({ cardRef, extra }, index) => {
      const card = await loadCard(cardRef.cardId, cardRef.lang)
      const price = await tcgdexFor(cardRef.lang)
        .getPrice(cardRef.cardId, cardRef.variant)
        .catch(() => undefined)
      const line: ShoppingRow = {
        key: `${index}:${cardRef.lang}:${cardRef.cardId}:${cardRef.variant}`,
        cardId: cardRef.cardId,
        lang: cardRef.lang,
        variant: cardRef.variant,
        name: card?.name ?? cardRef.cardId,
        setName: card?.setName ?? '',
        number: card ? (card.officialCount === undefined ? card.localId : `${card.localId}/${card.officialCount}`) : '',
        count: extra,
      }
      if (price) line.price = price.amount
      if (price?.productId !== undefined) line.cardmarketId = price.productId
      return line
    },
    onProgress,
  )
}

/** The missing cards of a binder as lines of a shopping list, in binder order. */
export async function loadShoppingRows(binder: Binder, onProgress?: Progress): Promise<ShoppingRow[]> {
  const { rows, products } = await loadList(binder, true, onProgress)
  return rows.map((row, index) => {
    const line: ShoppingRow = {
      // one line per pocket, like the checklist: a card missing twice is bought twice
      key: `${index}:${priceKey(row)}`,
      cardId: row.cardId,
      lang: row.lang,
      variant: row.variant,
      name: row.name,
      setName: row.setName,
      number: row.number,
    }
    if (row.price !== undefined) line.price = row.price
    const product = products.get(priceKey(row))
    if (product !== undefined) line.cardmarketId = product
    return line
  })
}

/**
 * The missing cards of a binder as lines for Cardmarket's wants list (see
 * `cardmarketList.ts`), in binder order. `skipped` counts the missing cards that could
 * not be put into words Cardmarket understands: no English card of that id, or no answer.
 */
export async function loadCardmarketList(
  binder: Binder,
  onProgress?: Progress,
): Promise<{ lines: string[]; skipped: number }> {
  const missing = binder.pages.flatMap((page) =>
    page.slots.flatMap((slot) => (slot.cardRef && !slot.owned ? [slot.cardRef] : [])),
  )
  const cards = await mapWithConcurrency(
    missing,
    8,
    async (ref) => {
      const raw = await tcgdexFor(ref.lang).getEnglishCard(ref.cardId)
      return typeof raw === 'object' && raw !== null ? cardmarketCardOf(raw as RawListedCard) : undefined
    },
    onProgress,
  )
  const listed = cards.filter((card) => card !== undefined)
  return { lines: cardmarketLines(listed), skipped: cards.length - listed.length }
}

export function slugOf(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'binder'
}

export function missingListFileName(
  binderName: string,
  isoDate: string,
  kind: 'pdf' | 'csv' = 'pdf',
): string {
  return `fehlende-karten-${slugOf(binderName)}-${isoDate.slice(0, 10)}.${kind}`
}

export function proxyFileName(binderName: string, isoDate: string): string {
  return `platzhalter-${slugOf(binderName)}-${isoDate.slice(0, 10)}.pdf`
}

export function download(content: BlobPart, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Offers the checklist of missing cards as a PDF download. */
export async function downloadMissingList(binder: Binder, onProgress?: Progress): Promise<void> {
  const rows = await loadMissingList(binder, onProgress)
  const now = new Date()
  const title = de.missingList.title(binder.name)
  const wideFont = await wideFontFor([title, ...rows.flatMap((row) => [row.name, row.setName])])
  const bytes = await createMissingListPdf({
    ...(wideFont ? { wideFont } : {}),
    title,
    subtitle: de.missingList.subtitle(rows.length, new Intl.DateTimeFormat('de-DE').format(now)),
    emptyText: de.missingList.empty,
    columns: de.missingList.columns,
    rows,
    variantLabel: de.variantLabel,
    languageLabel: (lang) => de.languageCodes[lang],
    priceLabel: de.price.amount,
    totalLabel: de.missingList.total,
    pageLabel: de.missingList.page,
  })
  download(bytes as Uint8Array<ArrayBuffer>, 'application/pdf', missingListFileName(binder.name, now.toISOString()))
}

/** Offers the list of missing cards as a table that Excel opens by double click. */
export async function downloadMissingListCsv(binder: Binder, onProgress?: Progress): Promise<void> {
  const rows = await loadMissingList(binder, onProgress)
  const csv = missingListCsv(rows, {
    columns: de.missingList.csvColumns,
    total: de.missingList.csvTotal,
    variantLabel: de.variantLabel,
    languageLabel: (lang) => de.languages[lang],
  })
  download(csv, 'text/csv;charset=utf-8', missingListFileName(binder.name, new Date().toISOString(), 'csv'))
}

/** The picture at `url` as a black and white JPEG; `undefined` if it cannot be loaded. */
async function greyJpeg(url: string): Promise<Uint8Array | undefined> {
  try {
    const picture = await readPicture(url)
    if (!picture) return undefined
    const bitmap = await createImageBitmap(picture)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) return undefined
      context.filter = 'grayscale(1)'
      context.drawImage(bitmap, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', PROXY_JPEG_QUALITY),
      )
      return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
    } finally {
      bitmap.close()
    }
  } catch {
    return undefined
  }
}

/**
 * Offers placeholders for the missing cards as a PDF to print: black and white pictures,
 * nine per A4 sheet, in binder order.
 */
export async function downloadProxies(binder: Binder, onProgress?: Progress): Promise<void> {
  const { rows, cards } = await loadList(binder, false)

  // a card and its other finishes look the same in black and white: one picture serves all
  const pictures = new Map<string, Uint8Array>()
  const pictured = [...new Map(rows.map((row) => [cardKey(row.cardId, row.lang), row])).values()]
  await mapWithConcurrency(
    pictured,
    PARALLEL_REQUESTS,
    async (row) => {
      const key = cardKey(row.cardId, row.lang)
      for (const image of cards.get(key)?.images ?? []) {
        const jpeg = await greyJpeg(image)
        if (jpeg) {
          pictures.set(key, jpeg)
          break
        }
      }
    },
    onProgress,
  )
  const proxies = rows.map((row): ProxyCard => {
    const key = cardKey(row.cardId, row.lang)
    const jpeg = pictures.get(key)
    return jpeg
      ? { name: row.name, number: row.number, jpeg, imageKey: key }
      : { name: row.name, number: row.number }
  })
  const now = new Date()
  // only cards without a picture have their name printed
  const wideFont = await wideFontFor(proxies.filter((card) => !card.jpeg).map((card) => card.name))
  const bytes = await createProxyPdf({
    ...(wideFont ? { wideFont } : {}),
    title: de.proxies.title(binder.name),
    footer: de.proxies.footer,
    cards: proxies,
  })
  download(bytes as Uint8Array<ArrayBuffer>, 'application/pdf', proxyFileName(binder.name, now.toISOString()))
}
