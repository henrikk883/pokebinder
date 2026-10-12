import { useEffect, useState } from 'react'
import { mapWithConcurrency, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { loadColourIndex, loadLookIndex } from './colourIndex'
import { similarCards } from './similarCards'

/** How many similar cards are shown. */
export const SIMILAR_COUNT = 24
/** How many cards of a theme are shown. */
export const THEME_COUNT = 48

export interface FoundCard {
  card: CardSummary
  /** Language the card is shown in: the one asked for, English where it does not exist in it. */
  lang: CardLang
}

export type FoundCards =
  | { status: 'loading' }
  | { status: 'error' }
  /** Nothing is known of this card (cards that exist in Japanese only, new cards). */
  | { status: 'unknown' }
  | { status: 'ready'; cards: FoundCard[] }

/** The cards behind ids of English cards, in `lang` where they exist in it. */
async function cardsOf(ids: readonly string[], lang: CardLang): Promise<FoundCard[]> {
  const cards = await mapWithConcurrency(ids, 6, async (id): Promise<FoundCard | undefined> => {
    const own = lang === 'en' ? undefined : await tcgdexFor(lang).getCard(id).catch(() => undefined)
    // a card without a picture in that language is shown in English, where it has one
    if (own?.image) return { card: own, lang }
    const english = await tcgdexFor('en').getCard(id).catch(() => undefined)
    if (english) return { card: english, lang: 'en' }
    return own ? { card: own, lang } : undefined
  })
  return cards.filter((entry) => entry !== undefined)
}

async function findSimilar(cardId: string, lang: CardLang): Promise<FoundCards> {
  // without what the image model has seen, the colours alone still give an answer
  const [colours, looks] = await Promise.all([loadColourIndex(), loadLookIndex().catch(() => undefined)])
  const ids = similarCards(colours, looks, cardId, SIMILAR_COUNT)
  return ids ? { status: 'ready', cards: await cardsOf(ids, lang) } : { status: 'unknown' }
}

async function findTheme(themeId: string, lang: CardLang): Promise<FoundCards> {
  const theme = (await loadLookIndex()).themes.find((entry) => entry.id === themeId)
  return theme ? { status: 'ready', cards: await cardsOf(theme.cards.slice(0, THEME_COUNT), lang) } : { status: 'unknown' }
}

function useFound(key: string | undefined, find: () => Promise<FoundCards>): FoundCards {
  const [found, setFound] = useState<{ key: string; result: FoundCards }>()

  useEffect(() => {
    if (key === undefined) return
    let cancelled = false
    find().then(
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
    // `find` belongs to the key: the same key asks for the same cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return found && found.key === key ? found.result : { status: 'loading' }
}

/** The cards of the high rarities that look most like a card. */
export function useSimilarCards(cardId: string, lang: CardLang): FoundCards {
  return useFound(`similar:${lang}:${cardId}`, () => findSimilar(cardId, lang))
}

/** The cards that fit a theme best; loading until a theme is chosen. */
export function useThemeCards(themeId: string | undefined, lang: CardLang): FoundCards {
  return useFound(themeId === undefined ? undefined : `theme:${lang}:${themeId}`, () =>
    themeId === undefined ? Promise.resolve<FoundCards>({ status: 'unknown' }) : findTheme(themeId, lang),
  )
}

/** The ids of the themes there are; `undefined` while loading, `null` when they cannot be loaded. */
export function useThemeIds(): readonly string[] | null | undefined {
  const [ids, setIds] = useState<readonly string[] | null>()

  useEffect(() => {
    let cancelled = false
    loadLookIndex().then(
      (looks) => {
        if (!cancelled) setIds(looks.themes.map((theme) => theme.id))
      },
      () => {
        if (!cancelled) setIds(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return ids
}
