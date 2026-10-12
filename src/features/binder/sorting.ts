import { compareLocalId, setIdOfCardId } from '../../lib/tcgdex'
import { compareVariants } from '../../types/binder'
import type { PlacedCard } from './binderModel'

export type CardComparator = (a: PlacedCard, b: PlacedCard) => number

/**
 * Order for "sort by Pokédex number": Bisasam (1) before Glurak (6) before Pikachu (25),
 * whatever set they are from. Cards of the same Pokémon, and cards without a number
 * (trainers, energy, unknown cards), follow `otherwise`; those without a number come last.
 */
export function createDexComparator(
  dexNumberOf: (card: PlacedCard) => number | undefined,
  otherwise: CardComparator,
): CardComparator {
  return (a, b) => {
    const left = dexNumberOf(a) ?? Number.POSITIVE_INFINITY
    const right = dexNumberOf(b) ?? Number.POSITIVE_INFINITY
    if (left !== right) return left < right ? -1 : 1
    return otherwise(a, b)
  }
}

/**
 * Order for "sort by set and number": sets as given (release order), cards of unknown
 * sets last, then the card number, then the variant (normal, holo, reverse, then patterns).
 */
export function createCardComparator(
  setOrder: readonly string[],
): (a: PlacedCard, b: PlacedCard) => number {
  const rank = new Map(setOrder.map((setId, index) => [setId, index]))

  function parts(cardId: string) {
    const setId = setIdOfCardId(cardId, rank)
    return setId === undefined
      ? { rank: Number.POSITIVE_INFINITY, setId: '', localId: cardId }
      : { rank: rank.get(setId) ?? Number.POSITIVE_INFINITY, setId, localId: cardId.slice(setId.length + 1) }
  }

  return (a, b) => {
    const left = parts(a.cardRef.cardId)
    const right = parts(b.cardRef.cardId)
    if (left.rank !== right.rank) return left.rank < right.rank ? -1 : 1
    return (
      compareLocalId(left.localId, right.localId) ||
      compareVariants(a.cardRef.variant, b.cardRef.variant)
    )
  }
}
