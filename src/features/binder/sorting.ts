import { compareLocalId, setIdOfCardId } from '../../lib/tcgdex'
import { compareVariants } from '../../types/binder'
import type { PlacedCard } from './binderModel'

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
