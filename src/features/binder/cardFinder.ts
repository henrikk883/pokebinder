import { matchesNumber } from '../../lib/tcgdex'
import type { Binder, CardRef, SlotPosition } from '../../types/binder'

/** A card lying in a binder, with where it lies. */
export interface PlacedRef {
  position: SlotPosition
  /** Index of the page, starting at 0, and of the pocket on it. */
  pageIndex: number
  slotIndex: number
  cardRef: CardRef
}

/** A card of the binder with what one searches by: its name and its number in the set. */
export interface FindEntry extends PlacedRef {
  name: string
  localId: string
}

/** Every card of the binder in the order of its pockets. */
export function placedRefs(binder: Binder): PlacedRef[] {
  return binder.pages.flatMap((page, pageIndex) =>
    page.slots.flatMap((slot) =>
      slot.cardRef
        ? [{ position: { pageId: page.id, slotIndex: slot.index }, pageIndex, slotIndex: slot.index, cardRef: slot.cardRef }]
        : [],
    ),
  )
}

/** Lower case and without accents, so that "pokemon" finds "Pokémon". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Whether what was typed means this card: a part of its name, or its number – alone
 * ("25", "025") or as printed on the card ("025/165").
 */
export function matchesCard(card: { name: string; localId: string }, query: string): boolean {
  const wanted = normalizeText(query)
  if (wanted === '') return false
  if (normalizeText(card.name).includes(wanted)) return true
  const number = wanted.split('/')[0] ?? ''
  return number !== '' && matchesNumber(card.localId, number)
}

/** The cards of the binder that match, in the order they lie in it; at most \`limit\`. */
export function findCards(entries: readonly FindEntry[], query: string, limit = 30): FindEntry[] {
  return entries.filter((entry) => matchesCard(entry, query)).slice(0, limit)
}
