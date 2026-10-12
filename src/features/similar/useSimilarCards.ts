import { useEffect, useState } from 'react'
import { mapWithConcurrency, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { loadColourIndex } from './colourIndex'
import { similarColours } from './similarColours'

/** How many similar cards are shown. */
export const SIMILAR_COUNT = 24

export interface SimilarCard {
  card: CardSummary
  /** Language the card is shown in: that of the card asked about, English where it does not exist in it. */
  lang: CardLang
}

export type SimilarCards =
  | { status: 'loading' }
  | { status: 'error' }
  /** The colours of this card are not known (cards that exist in Japanese only, new cards). */
  | { status: 'unknown' }
  | { status: 'ready'; cards: SimilarCard[] }

async function find(cardId: string, lang: CardLang): Promise<SimilarCards> {
  const ids = similarColours(await loadColourIndex(), cardId, SIMILAR_COUNT)
  if (!ids) return { status: 'unknown' }
  const cards = await mapWithConcurrency(ids, 6, async (id): Promise<SimilarCard | undefined> => {
    const own = lang === 'en' ? undefined : await tcgdexFor(lang).getCard(id).catch(() => undefined)
    // a card without a picture in that language is shown in English, where it has one
    if (own?.image) return { card: own, lang }
    const english = await tcgdexFor('en').getCard(id).catch(() => undefined)
    if (english) return { card: english, lang: 'en' }
    return own ? { card: own, lang } : undefined
  })
  return { status: 'ready', cards: cards.filter((entry) => entry !== undefined) }
}

/** The cards whose pictures are nearest in colour to that of a card. */
export function useSimilarCards(cardId: string, lang: CardLang): SimilarCards {
  const key = `${lang}:${cardId}`
  const [found, setFound] = useState<{ key: string; result: SimilarCards }>()

  useEffect(() => {
    let cancelled = false
    find(cardId, lang).then(
      (result) => {
        if (!cancelled) setFound({ key, result })
      },
      () => {
        if (!cancelled) setFound({ key, result: { status: 'error' } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [cardId, lang, key])

  return found && found.key === key ? found.result : { status: 'loading' }
}
