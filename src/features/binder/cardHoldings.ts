import type { Binder, CardLang } from '../../types/binder'
import { copiesOf, countedPages } from './binderModel'

/** Where a card lies in one binder, in one language. */
export interface CardHolding {
  binderId: string
  binderName: string
  lang: CardLang
  /** Copies that are there: pockets ticked off, with their counts. */
  copies: number
  /** Pockets that wait for the card. */
  missing: number
  /** Page numbers as shown in the UI (from 1), in order, each once; `TRAY_PAGE` for the tray. */
  pages: number[]
}

export interface CardHoldings {
  /** Copies in all binders together, whatever the language or finish. */
  copies: number
  /** One entry per binder and language the card has a pocket in, in the order of the binders. */
  places: CardHolding[]
}

/**
 * How often a card is in the collection and in which binders it lies. A card counts in
 * every language and finish; the language is named, so that a German and an English copy
 * can be told apart.
 */
export function holdingsOf(binders: readonly Binder[], cardId: string): CardHoldings {
  const places: CardHolding[] = []
  let copies = 0
  for (const binder of binders) {
    const byLang = new Map<CardLang, CardHolding>()
    countedPages(binder).forEach((page) => {
      const pageNumber = page.index + 1
      for (const slot of page.slots) {
        if (slot.cardRef?.cardId !== cardId) continue
        let place = byLang.get(slot.cardRef.lang)
        if (!place) {
          place = { binderId: binder.id, binderName: binder.name, lang: slot.cardRef.lang, copies: 0, missing: 0, pages: [] }
          byLang.set(slot.cardRef.lang, place)
        }
        const there = copiesOf(slot)
        place.copies += there
        if (there === 0) place.missing += 1
        if (!place.pages.includes(pageNumber)) place.pages.push(pageNumber)
        copies += there
      }
    })
    places.push(...byLang.values())
  }
  return { copies, places }
}
