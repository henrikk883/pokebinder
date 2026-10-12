import { useEffect, useState } from 'react'
import { baseVariant, tcgdexFor } from '../../lib/tcgdex'
import type { DeckCard } from '../../types/deck'
import type { DeckCardInfo, InfoOf } from './deckModel'

const keyOf = (card: Pick<DeckCard, 'cardId' | 'lang'>) => `${card.lang}:${card.cardId}`

// What was found out stays for as long as the app is open; a card is asked about once.
const known = new Map<string, DeckCardInfo>()
const asked = new Set<string>()
const listeners = new Set<() => void>()

async function lookUp(card: DeckCard): Promise<void> {
  const key = keyOf(card)
  if (asked.has(key)) return
  asked.add(key)
  try {
    const client = tcgdexFor(card.lang)
    const [summary, play, price] = await Promise.all([
      client.getCard(card.cardId),
      client.getPlayInfo(card.cardId),
      // a deck does not say in which finish a card is: the one every copy of it has
      client
        .getCardDetail(card.cardId)
        .catch(() => undefined)
        .then((detail) => client.getPrice(card.cardId, detail ? baseVariant(detail.variants) : 'normal'))
        .catch(() => undefined),
    ])
    if (!summary) throw new Error('unknown card')
    const info: DeckCardInfo = {
      name: summary.name,
      category: play?.category ?? 'unknown',
      basicEnergy: play?.basicEnergy ?? false,
    }
    if (play?.legal) info.legal = play.legal
    if (price) info.price = price.amount
    known.set(key, info)
    for (const listener of listeners) listener()
  } catch {
    // may be asked again the next time a deck shows the card
    asked.delete(key)
  }
}

/**
 * What the deck itself does not store about its cards: name, kind, price and where they
 * may be played. Until a card is looked up the returned function knows nothing about it.
 */
export function useDeckInfo(cards: readonly DeckCard[]): InfoOf {
  const [, setFound] = useState(0)

  useEffect(() => {
    const listener = () => setFound((count) => count + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    for (const card of cards) void lookUp(card)
  }, [cards])

  return (card) => known.get(keyOf(card))
}
