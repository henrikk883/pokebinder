import type { Binder } from '../../types/binder'
import type { Deck, DeckCard } from '../../types/deck'
import { copiesOf, countedPages } from '../binder/binderModel'
import type { InfoOf } from './deckModel'

const keyOf = (card: Pick<DeckCard, 'cardId' | 'lang'>) => `${card.lang}:${card.cardId}`

/** How many copies of each card lie in the binders as owned, whatever the finish. */
export type OwnedCopies = ReadonlyMap<string, number>

export function ownedCopies(binders: readonly Binder[]): OwnedCopies {
  const owned = new Map<string, number>()
  for (const binder of binders) {
    for (const page of countedPages(binder)) {
      for (const slot of page.slots) {
        const copies = copiesOf(slot)
        if (!slot.cardRef || copies === 0) continue
        const key = keyOf(slot.cardRef)
        owned.set(key, (owned.get(key) ?? 0) + copies)
      }
    }
  }
  return owned
}

/** Of the copies the deck wants of a card, how many the binders hold. */
export function copiesAtHand(card: DeckCard, owned: OwnedCopies): number {
  return Math.min(card.count, owned.get(keyOf(card)) ?? 0)
}

export interface DeckCoverage {
  /** Cards of the deck that are in the binders, copies counted. */
  have: number
  /** Cards that would still have to be got. */
  missing: number
}

/** How far the collection goes towards the deck: exactly the cards named, in their language. */
export function deckCoverage(deck: Deck, owned: OwnedCopies): DeckCoverage {
  let have = 0
  let size = 0
  for (const card of deck.cards) {
    have += copiesAtHand(card, owned)
    size += card.count
  }
  return { have, missing: size - have }
}

export interface DeckWorth {
  /** What the whole deck costs at Cardmarket, in euros. */
  worth: number
  /** What the cards not in the binders would cost. */
  missingWorth: number
  /** Cards (copies counted) without a price; both sums leave them out. */
  unpriced: number
}

/** Adds up prices in cents, so that many small amounts do not drift. */
export function deckWorth(deck: Deck, infoOf: InfoOf, owned: OwnedCopies): DeckWorth {
  let cents = 0
  let missingCents = 0
  let unpriced = 0
  for (const card of deck.cards) {
    const price = infoOf(card)?.price
    if (price === undefined) {
      unpriced += card.count
      continue
    }
    const each = Math.round(price * 100)
    cents += each * card.count
    missingCents += each * (card.count - copiesAtHand(card, owned))
  }
  return { worth: cents / 100, missingWorth: missingCents / 100, unpriced }
}
