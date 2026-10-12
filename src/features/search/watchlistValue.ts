import { baseVariant, mapWithConcurrency, setIdOfCardId, tcgdexFor } from '../../lib/tcgdex'
import type { ShoppingRow } from '../export/shopping'
import type { SavedCard } from './watchlist'

export interface ListValue {
  /** What the cards of the list cost together at Cardmarket, in euros. */
  total: number
  /** Cards Cardmarket has no price for; the sum leaves them out. */
  unpriced: number
}

/** Adds up prices in cents, so that many small amounts do not drift. */
export function sumPrices(prices: readonly (number | undefined)[]): ListValue {
  let cents = 0
  let unpriced = 0
  for (const price of prices) {
    if (price === undefined) unpriced++
    else cents += Math.round(price * 100)
  }
  return { total: cents / 100, unpriced }
}

/**
 * Looks up what the cards of a list cost and adds it up. A list names cards, not finishes,
 * so each card counts in its base finish (normal where there is one, else holo), which is
 * also how it lands in a binder. Needs requests per card; `onProgress` reports how far
 * the loading is.
 */
export async function loadListValue(
  cards: readonly SavedCard[],
  onProgress?: (done: number, total: number) => void,
): Promise<ListValue> {
  const prices = await mapWithConcurrency(
    cards,
    8,
    async (card) => {
      const client = tcgdexFor(card.lang)
      const detail = await client.getCardDetail(card.cardId).catch(() => undefined)
      const price = await client
        .getPrice(card.cardId, baseVariant(detail?.variants ?? []))
        .catch(() => undefined)
      return price?.amount
    },
    onProgress,
  )
  return sumPrices(prices)
}

/**
 * The cards of a list as lines of a shopping list, in the order of the list. Each counts
 * in its base finish, as in `loadListValue`.
 */
export async function loadListShoppingRows(
  cards: readonly SavedCard[],
  onProgress?: (done: number, total: number) => void,
): Promise<ShoppingRow[]> {
  return mapWithConcurrency(
    cards,
    8,
    async (card, index) => {
      const client = tcgdexFor(card.lang)
      const detail = await client.getCardDetail(card.cardId).catch(() => undefined)
      const variant = baseVariant(detail?.variants ?? [])
      const price = await client.getPrice(card.cardId, variant).catch(() => undefined)
      const { setsById } = await client.getCatalog()
      const set = setsById.get(setIdOfCardId(card.cardId, setsById) ?? '')
      const line: ShoppingRow = {
        key: `${index}:${card.lang}:${card.cardId}`,
        cardId: card.cardId,
        lang: card.lang,
        variant,
        // a card TCGdex cannot be asked about still stands on the list, by its id
        name: detail?.name ?? card.cardId,
        setName: set?.name ?? '',
        number: detail ? (set ? `${detail.localId}/${set.cardCount.official}` : detail.localId) : '',
      }
      if (price) line.price = price.amount
      if (price?.productId !== undefined) line.cardmarketId = price.productId
      return line
    },
    onProgress,
  )
}
