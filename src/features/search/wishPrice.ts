import { useEffect, useState } from 'react'
import { baseVariant, tcgdexFor } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import type { SavedCard, Watchlist } from './watchlist'

/** Reads an amount as it is typed in German or English: "5", "5,50", "5.5", "5 €". */
export function parseAmount(text: string): number | undefined {
  const cleaned = text.replace(/€/g, '').replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined
  const amount = Number(cleaned)
  return amount > 0 ? amount : undefined
}

/** Whether a card can be had for what the collector is willing to pay, or less. */
export function isBelowWish(price: number | undefined, wishPrice: number | undefined): boolean {
  return price !== undefined && wishPrice !== undefined && price <= wishPrice
}

/** Every noted card a wish price is set for, once, whatever list it is on. */
export function cardsWithWish(lists: readonly Watchlist[]): SavedCard[] {
  const seen = new Map<string, SavedCard>()
  for (const list of lists) {
    for (const card of list.cards) {
      if (card.wishPrice === undefined) continue
      const key = `${card.lang}:${card.cardId}`
      const known = seen.get(key)
      // on several lists with different wishes: the highest one is met first
      if (!known || (known.wishPrice ?? 0) < card.wishPrice) seen.set(key, card)
    }
  }
  return [...seen.values()]
}

const keyOf = (cardId: string, lang: CardLang) => `${lang}:${cardId}`

// Asked for once while the app is open; the app keeps prices for a day anyway.
const prices = new Map<string, number | null>()
const asked = new Set<string>()
const listeners = new Set<() => void>()

async function lookUp(cardId: string, lang: CardLang): Promise<void> {
  const key = keyOf(cardId, lang)
  if (asked.has(key)) return
  asked.add(key)
  try {
    const client = tcgdexFor(lang)
    // a list names cards, not finishes: each counts in the finish every copy of it has
    const detail = await client.getCardDetail(cardId).catch(() => undefined)
    const price = await client.getPrice(cardId, baseVariant(detail?.variants ?? []))
    prices.set(key, price?.amount ?? null)
    for (const listener of listeners) listener()
  } catch {
    // no connection: asked again the next time the card is shown
    asked.delete(key)
  }
}

function usePriceUpdates(): void {
  const [, setFound] = useState(0)
  useEffect(() => {
    const listener = () => setFound((count) => count + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
}

/**
 * What a card costs right now, asked for only if \`wanted\`: prices need a request per
 * card, so only cards with a wish price are looked up. \`undefined\` while that is unknown.
 */
export function useCurrentPrice(cardId: string, lang: CardLang, wanted: boolean): number | undefined {
  usePriceUpdates()
  useEffect(() => {
    if (wanted) void lookUp(cardId, lang)
  }, [cardId, lang, wanted])
  return wanted ? (prices.get(keyOf(cardId, lang)) ?? undefined) : undefined
}

/** How many noted cards can be had for their wish price or less right now. */
export function useWishAlarms(lists: readonly Watchlist[]): number {
  usePriceUpdates()
  const wished = cardsWithWish(lists)
  const watched = wished.map((card) => keyOf(card.cardId, card.lang)).join('|')
  useEffect(() => {
    for (const card of cardsWithWish(lists)) void lookUp(card.cardId, card.lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- \`watched\` names the cards that matter
  }, [watched])
  return wished.filter((card) => isBelowWish(prices.get(keyOf(card.cardId, card.lang)) ?? undefined, card.wishPrice)).length
}
