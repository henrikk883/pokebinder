import type { CardSummary } from './types'

/** Set id of a card; card ids are `<setId>-<localId>`, and set ids may contain dashes themselves. */
export function setIdOfCard(card: Pick<CardSummary, 'id' | 'localId'>): string {
  const suffix = `-${card.localId}`
  if (card.id.endsWith(suffix)) return card.id.slice(0, -suffix.length)
  const lastDash = card.id.lastIndexOf('-')
  return lastDash === -1 ? card.id : card.id.slice(0, lastDash)
}

const numberOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

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
