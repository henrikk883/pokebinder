import { useEffect, useState } from 'react'
import { tcgdex, type CardSummary } from '../../lib/tcgdex'

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
