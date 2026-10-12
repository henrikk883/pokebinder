import type { Binder, CardRef } from '../../types/binder'
import { copiesOf } from '../binder/binderModel'

/**
 * Who could give whom what: the spare cards of one collector that another is missing. A
 * card counts in the language and the finish it is in – a spare reverse holo is no help to
 * somebody who is missing the plain card.
 */

const keyOf = (ref: CardRef) => `${ref.lang}:${ref.cardId}:${ref.variant}`

interface Counted {
  cardRef: CardRef
  count: number
}

function add(cards: Map<string, Counted>, cardRef: CardRef, count: number): void {
  const key = keyOf(cardRef)
  const known = cards.get(key)
  if (known) known.count += count
  else cards.set(key, { cardRef, count })
}

/** The copies there are beyond the one each pocket holds, over all the binders given. */
export function spareCards(binders: readonly Binder[]): Map<string, Counted> {
  const spare = new Map<string, Counted>()
  for (const binder of binders) {
    for (const page of binder.pages) {
      for (const slot of page.slots) {
        const extra = copiesOf(slot) - 1
        if (slot.cardRef && extra > 0) add(spare, slot.cardRef, extra)
      }
    }
  }
  return spare
}

/** The cards that have a pocket but are not there, with how many pockets wait for them. */
export function missingCards(binders: readonly Binder[]): Map<string, Counted> {
  const missing = new Map<string, Counted>()
  for (const binder of binders) {
    for (const page of binder.pages) {
      for (const slot of page.slots) {
        if (slot.cardRef && !slot.owned) add(missing, slot.cardRef, 1)
      }
    }
  }
  return missing
}

export interface TradeCard {
  cardRef: CardRef
  /** How many copies could change hands: no more than are spare, no more than are missing. */
  count: number
}

/** What the giver has spare that the taker is missing, in the order the giver's binders hold it. */
export function tradable(giver: readonly Binder[], taker: readonly Binder[]): TradeCard[] {
  const missing = missingCards(taker)
  const cards: TradeCard[] = []
  for (const [key, spare] of spareCards(giver)) {
    const wanted = missing.get(key)
    if (wanted) cards.push({ cardRef: spare.cardRef, count: Math.min(spare.count, wanted.count) })
  }
  return cards
}

export interface TradeMatch {
  /** What the other collector could give this one. */
  forMe: TradeCard[]
  /** What this collector could give the other. */
  forThem: TradeCard[]
}

/** Both directions between this collector's binders and the binders of another. */
export function matchTrade(mine: readonly Binder[], theirs: readonly Binder[]): TradeMatch {
  return { forMe: tradable(theirs, mine), forThem: tradable(mine, theirs) }
}
