import type { CardSummary, Catalog } from './types'

/** Set id of a card; card ids are `<setId>-<localId>`, and set ids may contain dashes themselves. */
export function setIdOfCard(card: Pick<CardSummary, 'id' | 'localId'>): string {
  const suffix = `-${card.localId}`
  if (card.id.endsWith(suffix)) return card.id.slice(0, -suffix.length)
  const lastDash = card.id.lastIndexOf('-')
  return lastDash === -1 ? card.id : card.id.slice(0, lastDash)
}

/**
 * Set id of a card id alone, e.g. from a binder. Both parts may contain dashes, so the id is
 * matched against the sets that exist; the longest matching set wins.
 */
export function setIdOfCardId(
  cardId: string,
  knownSets: { has(setId: string): boolean },
): string | undefined {
  for (let dash = cardId.lastIndexOf('-'); dash > 0; dash = cardId.lastIndexOf('-', dash - 1)) {
    const candidate = cardId.slice(0, dash)
    if (knownSets.has(candidate)) return candidate
  }
  return undefined
}

/** Sets in the order they were released, oldest first. */
export function chronologicalSetIds(catalog: Pick<Catalog, 'series'>): string[] {
  return [...catalog.series].reverse().flatMap((series) => series.sets.map((set) => set.id))
}

const numberOrder =new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** Number order as printed on the cards: 2 before 10, plain numbers before prefixed ones like TG01. */
export function compareLocalId(a: string, b: string): number {
  const aIsNumber = /^\d/.test(a)
  const bIsNumber = /^\d/.test(b)
  if (aIsNumber !== bIsNumber) return aIsNumber ? -1 : 1
  return numberOrder.compare(a, b)
}

export function sortByNumber<T extends Pick<CardSummary, 'localId'>>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => compareLocalId(a.localId, b.localId))
}

/** Whether a card number matches what the user typed, ignoring leading zeros and case. */
export function matchesNumber(localId: string, input: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^0+(?=.)/, '')
  return normalize(localId) === normalize(input)
}
