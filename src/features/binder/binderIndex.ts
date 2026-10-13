import type { Binder, CardLang } from '../../types/binder'
import { countedPages } from './binderModel'

/** How a card is in a binder: in how many pockets (the tray counts), and in which languages. */
export interface CardPresence {
  pockets: number
  langs: CardLang[]
}

// A binder is never changed in place, so what was counted for one stays true for it.
const counted = new WeakMap<Binder, ReadonlyMap<string, CardPresence>>()

function count(binder: Binder): ReadonlyMap<string, CardPresence> {
  const cards = new Map<string, CardPresence>()
  for (const page of countedPages(binder)) {
    for (const slot of page.slots) {
      if (!slot.cardRef) continue
      const { cardId, lang } = slot.cardRef
      const known = cards.get(cardId) ?? { pockets: 0, langs: [] }
      known.pockets += 1
      if (!known.langs.includes(lang)) known.langs.push(lang)
      cards.set(cardId, known)
    }
  }
  return cards
}

/**
 * Whether a card lies in a binder already, whatever its language or finish, and whether it
 * is there or still missing: in its pockets or laid aside in its tray. `undefined` for a
 * card that is not in it. Counted once per state of the binder, so that every card of a
 * long search can ask.
 */
export function presenceIn(binder: Binder, cardId: string): CardPresence | undefined {
  let cards = counted.get(binder)
  if (!cards) {
    cards = count(binder)
    counted.set(binder, cards)
  }
  return cards.get(cardId)
}
