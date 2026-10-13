import { compareLocalId, setIdOfCard, type CardSummary } from '../../lib/tcgdex'

/** What is known of a card of a list for finding and ordering it: the card, and the name of its set. */
export interface ListedCard {
  card: CardSummary
  setName?: string
}

/** Orders a list of cards can be shown in. `added` is the order the list itself keeps. */
export const LIST_ORDERS = ['added', 'name', 'set', 'colour'] as const
export type ListOrder = (typeof LIST_ORDERS)[number]

const fold = (text: string) => text.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '')

/**
 * Whether a card answers to what was typed into the search of a list: every word must be
 * part of its name, its number, its set or its id. Nothing typed finds every card; a card
 * that is not known yet answers by its id only.
 */
export function matchesListSearch(typed: string, cardId: string, listed: ListedCard | undefined): boolean {
  const words = fold(typed).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = fold([cardId, listed?.card.name ?? '', listed?.card.localId ?? '', listed?.setName ?? ''].join(' '))
  return words.every((word) => text.includes(word))
}

const byName = new Intl.Collator('de', { sensitivity: 'base', numeric: true })

/**
 * The entries of a list in another order. By name or by set and number, entries whose card
 * is not known come last; entries that are equal keep the order of the list. `added` and
 * `colour` change nothing here: the first is the order of the list, the second needs the
 * colours of the pictures and is done by whoever has them.
 */
export function sortListed<T>(entries: readonly T[], order: ListOrder, listedOf: (entry: T) => ListedCard | undefined): T[] {
  if (order === 'added' || order === 'colour') return [...entries]
  const compare = (a: ListedCard, b: ListedCard) =>
    order === 'name'
      ? byName.compare(a.card.name, b.card.name)
      : byName.compare(a.setName ?? setIdOfCard(a.card), b.setName ?? setIdOfCard(b.card)) ||
        compareLocalId(a.card.localId, b.card.localId)
  return entries
    .map((entry, position) => ({ entry, position, listed: listedOf(entry) }))
    .sort((a, b) => {
      if (!a.listed || !b.listed) return a.listed ? -1 : b.listed ? 1 : a.position - b.position
      return compare(a.listed, b.listed) || a.position - b.position
    })
    .map(({ entry }) => entry)
}
