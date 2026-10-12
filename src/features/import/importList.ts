import { matchesNumber, type CardSummary, type SetSummary } from '../../lib/tcgdex'
import type { Binder, CardLang, CardRef, CardVariant, Layout, Slot } from '../../types/binder'
import { createBinder, createPage, defaultContext, slotsPerPage, type ModelContext } from '../binder/binderModel'
import { normalizeText } from '../binder/cardFinder'
import type { WantsEntry } from './cardmarketWants'

/** Why an entry of a list could not be turned into a card. */
export type ImportProblem =
  /** Wanted in any expansion: there is no saying which print is meant. */
  | 'anyExpansion'
  /** No set is called like the expansion. */
  | 'unknownSet'
  /** The set has no card of that number. */
  | 'unknownCard'
  /** A product that is no card of the set, e.g. a metal card sold with a collection. */
  | 'special'

export type ResolvedEntry =
  | { entry: WantsEntry; card: CardSummary; setId: string }
  | { entry: WantsEntry; problem: ImportProblem }

/** The sets whose name is the one given, in any of the lists handed in (one per language). */
export function setsNamed(expansion: string, catalogs: readonly (readonly SetSummary[])[]): string[] {
  const wanted = normalizeText(expansion)
  const ids = new Set<string>()
  for (const sets of catalogs) {
    for (const set of sets) if (normalizeText(set.name) === wanted) ids.add(set.id)
  }
  return [...ids]
}

/**
 * Finds the card an entry names among the cards of its set: by its number. `special` where
 * the entry's version is higher than the set has prints of that name – Cardmarket also
 * lists products there that are no cards of the set.
 */
export function cardOfEntry(entry: WantsEntry, setCards: readonly CardSummary[]): CardSummary | ImportProblem {
  const { number } = entry
  const card = number === undefined ? undefined : setCards.find((candidate) => matchesNumber(candidate.localId, number))
  if (!card) return 'unknownCard'
  const prints = setCards.filter((candidate) => candidate.name === card.name).length
  return entry.version !== undefined && entry.version > prints ? 'special' : card
}

export interface ImportedCard {
  cardId: string
  variant: CardVariant
}

/**
 * A new binder holding the given cards in the order of the list, one per pocket, as cards
 * that are still missing: a wants list names what one does not have yet.
 */
export function binderFromCards(
  input: { name: string; layout: Layout; lang: CardLang },
  cards: readonly ImportedCard[],
  ctx: ModelContext = defaultContext,
): Binder {
  const binder = createBinder({ name: input.name, layout: input.layout, lang: input.lang }, ctx)
  const perPage = slotsPerPage(input.layout)
  const pageCount = Math.max(1, Math.ceil(cards.length / perPage))
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
    const page = createPage(input.layout, pageIndex, binder.defaultOpeningSide, ctx)
    return {
      ...page,
      slots: page.slots.map((slot): Slot => {
        const card = cards[pageIndex * perPage + slot.index]
        if (!card) return slot
        const cardRef: CardRef = { cardId: card.cardId, lang: input.lang, variant: card.variant }
        return { index: slot.index, cardRef, owned: false }
      }),
    }
  })
  return { ...binder, pages }
}
