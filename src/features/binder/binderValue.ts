import { mapWithConcurrency, tcgdexFor } from '../../lib/tcgdex'
import type { Binder, CardRef } from '../../types/binder'
import { copiesOf } from './binderModel'

export interface BinderValue {
  /** Cardmarket value of the cards marked as owned, in euros. */
  owned: number
  /** What the missing cards would cost. */
  missing: number
  /** Cards Cardmarket has no price for; both sums leave them out. */
  unpriced: number
}

export interface ValuedCard {
  owned: boolean
  price?: number
  /** Copies of an owned card; one if left out. */
  copies?: number
}

/** Adds up prices in cents, so that many small amounts do not drift. */
export function summarizeValue(cards: readonly ValuedCard[]): BinderValue {
  let owned = 0
  let missing = 0
  let unpriced = 0
  for (const card of cards) {
    if (card.price === undefined) unpriced++
    else if (card.owned) owned += Math.round(card.price * 100) * Math.max(1, card.copies ?? 1)
    else missing += Math.round(card.price * 100)
  }
  return { owned: owned / 100, missing: missing / 100, unpriced }
}

const refKey = (ref: CardRef) => `${ref.lang}:${ref.cardId}:${ref.variant}`

/**
 * Looks up the Cardmarket price of every card in the binder and adds them up. A price
 * needs one request per card (kept for a day afterwards); `onProgress` reports how far
 * the loading is.
 */
export async function loadBinderValue(
  binder: Binder,
  onProgress?: (done: number, total: number) => void,
): Promise<BinderValue> {
  const cards = binder.pages.flatMap((page) =>
    page.slots.flatMap((slot) =>
      slot.cardRef ? [{ cardRef: slot.cardRef, owned: slot.owned, copies: Math.max(1, copiesOf(slot)) }] : [],
    ),
  )
  const unique = [...new Map(cards.map((card) => [refKey(card.cardRef), card.cardRef])).values()]
  const prices = new Map<string, number>()
  await mapWithConcurrency(
    unique,
    8,
    async (ref) => {
      const price = await tcgdexFor(ref.lang)
        .getPrice(ref.cardId, ref.variant)
        .catch(() => undefined)
      if (price) prices.set(refKey(ref), price.amount)
    },
    onProgress,
  )
  return summarizeValue(
    cards.map((card) => {
      const price = prices.get(refKey(card.cardRef))
      return price === undefined
        ? { owned: card.owned, copies: card.copies }
        : { owned: card.owned, copies: card.copies, price }
    }),
  )
}
