import { useEffect, useState } from 'react'
import { tcgdex, type CardDetail, type CardSummary } from '../../lib/tcgdex'

/**
 * Rarity and finishes of a card, for the selection column.
 * `undefined` while loading or when TCGdex has nothing on the card.
 */
export function useCardDetail(cardId: string | undefined): CardDetail | undefined {
  const [loaded, setLoaded] = useState<{ cardId: string; detail: CardDetail | undefined }>()

  useEffect(() => {
    if (cardId === undefined) return
    let cancelled = false
    tcgdex.getCardDetail(cardId).then(
      (detail) => {
        if (!cancelled) setLoaded({ cardId, detail })
      },
      () => {
        if (!cancelled) setLoaded({ cardId, detail: undefined })
      },
    )
    return () => {
      cancelled = true
    }
  }, [cardId])

  return loaded && loaded.cardId === cardId ? loaded.detail : undefined
}

/** `null`: TCGdex does not know the card, or it could not be loaded. */
type Resolved = CardSummary | null

// Cards seen once render immediately afterwards, e.g. after turning the page back.
const resolved = new Map<string, Resolved>()

/**
 * Name and image of a card a binder refers to.
 * `undefined` while loading, `null` when the card cannot be shown.
 */
export function useCard(cardId: string | undefined): Resolved | undefined {
  const [loaded, setLoaded] = useState<{ cardId: string; card: Resolved }>()

  useEffect(() => {
    if (cardId === undefined || resolved.has(cardId)) return
    let cancelled = false
    tcgdex.getCard(cardId).then(
      (card) => {
        resolved.set(cardId, card ?? null)
        if (!cancelled) setLoaded({ cardId, card: card ?? null })
      },
      () => {
        // not remembered: the next attempt may succeed
        if (!cancelled) setLoaded({ cardId, card: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [cardId])

  if (cardId === undefined) return undefined
  const known = resolved.get(cardId)
  if (known !== undefined) return known
  return loaded?.cardId === cardId ? loaded.card : undefined
}
