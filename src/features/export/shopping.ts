import type { CardLang, CardVariant } from '../../types/binder'

/** A card to buy: one line of the shopping list. */
export interface ShoppingRow {
  /** Tells the lines apart; the same card may be wanted more than once. */
  key: string
  cardId: string
  lang: CardLang
  variant: CardVariant
  name: string
  setName: string
  /** Number as printed on the card, e.g. `025/165`. */
  number: string
  /** Cardmarket price trend in euros; missing when Cardmarket has none. */
  price?: number
  /** Cardmarket's number of the product, for the link to it. */
  cardmarketId?: number
  /** How many of the card the line stands for; one if left out. */
  count?: number
}

const piecesOf = (row: Pick<ShoppingRow, 'count'>) => Math.max(1, row.count ?? 1)

/** How many cards the lines stand for together. */
export function cardCount(rows: readonly ShoppingRow[]): number {
  return rows.reduce((sum, row) => sum + piecesOf(row), 0)
}

export type ShoppingOrder = 'cheapest' | 'dearest' | 'binder'
export const SHOPPING_ORDERS: readonly ShoppingOrder[] = ['cheapest', 'dearest', 'binder']

/**
 * The list in the wanted order. Sorted by price, cards without a price come last either
 * way: they can be neither cheap nor dear. `binder` is the order the list came in.
 */
export function sortShopping(rows: readonly ShoppingRow[], order: ShoppingOrder): ShoppingRow[] {
  if (order === 'binder') return [...rows]
  const direction = order === 'cheapest' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (a.price === undefined || b.price === undefined) {
      return (a.price === undefined ? 1 : 0) - (b.price === undefined ? 1 : 0)
    }
    return (a.price - b.price) * direction
  })
}

export interface BudgetResult {
  /** Keys of the lines the money is enough for, starting with the cheapest. */
  affordable: ReadonlySet<string>
  /** What those cost together, in euros. */
  spent: number
}

/**
 * How far a budget goes when the cheapest cards are bought first: that gets the most
 * cards for the money. Cards without a price cannot be counted in.
 */
export function withinBudget(rows: readonly ShoppingRow[], budget: number): BudgetResult {
  const affordable = new Set<string>()
  const limit = Math.round(budget * 100)
  let spent = 0
  for (const row of sortShopping(rows, 'cheapest')) {
    if (row.price === undefined) break
    const cents = Math.round(row.price * 100) * piecesOf(row)
    if (spent + cents > limit) break
    spent += cents
    affordable.add(row.key)
  }
  return { affordable, spent: spent / 100 }
}

/** What all lines cost together, in euros, and how many have no price. */
export function shoppingTotal(rows: readonly ShoppingRow[]): { total: number; unpriced: number } {
  let cents = 0
  let unpriced = 0
  for (const row of rows) {
    if (row.price === undefined) unpriced += piecesOf(row)
    else cents += Math.round(row.price * 100) * piecesOf(row)
  }
  return { total: cents / 100, unpriced }
}

/**
 * An amount as typed in German ("50", "49,90", "1.200,50", also "49.90"); `undefined` for
 * anything that is not an amount of zero or more.
 */
export function parseBudget(text: string): number | undefined {
  const trimmed = text.trim().replace(/€/g, '').replace(/\s/g, '')
  if (trimmed === '') return undefined
  // with a comma, dots are thousands separators; without one, a dot is the decimal point
  const normal = trimmed.includes(',') ? trimmed.replace(/[.]/g, '').replace(',', '.') : trimmed
  if (!/^[0-9]+([.][0-9]+)?$/.test(normal)) return undefined
  return Number(normal)
}

const CARDMARKET = 'https://www.cardmarket.com/de/Pokemon/Products'

/**
 * Where the card is found at Cardmarket: its product page where the number of the product
 * is known, otherwise a search for its name. Only opened when the collector follows it.
 */
export function cardmarketUrl(row: Pick<ShoppingRow, 'name' | 'cardmarketId'>): string {
  return row.cardmarketId === undefined
    ? `${CARDMARKET}/Search?searchString=${encodeURIComponent(row.name)}`
    : `${CARDMARKET}?idProduct=${row.cardmarketId}`
}
