import { useEffect, useState } from 'react'
import { mapWithConcurrency, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { loadColourIndex, loadLookIndex } from './colourIndex'
import { similarCards } from './similarCards'
import { cardsOfColour, sortByColour, type PictureColour } from './similarColours'

/** How many similar cards are shown at first and added by "Mehr anzeigen", and how many at most. */
export const SIMILAR_STEP = 24
export const SIMILAR_MAX = 96
/** The same for the cards of a theme; the most is what `scripts/looks/looks.mjs` keeps per theme. */
export const THEME_STEP = 48
export const THEME_MAX = 144

/** Order of the cards of a theme: as they fit the theme, or by the colours of their pictures. */
export type ThemeOrder = 'fit' | 'colour'

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
  | {
      status: 'ready'
      cards: FoundCard[]
      /** There are more cards than these to ask for. */
      hasMore: boolean
      /** These are the cards of before; the ones asked for now are on their way. */
      updating: boolean
    }

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

async function findSimilar(cardId: string, lang: CardLang, count: number): Promise<FoundCards> {
  // without what the image model has seen, the colours alone still give an answer
  const [colours, looks] = await Promise.all([loadColourIndex(), loadLookIndex().catch(() => undefined)])
  const ids = similarCards(colours, looks, cardId, count + 1)
  if (!ids) return { status: 'unknown' }
  return {
    status: 'ready',
    cards: await cardsOf(ids.slice(0, count), lang),
    hasMore: ids.length > count && count < SIMILAR_MAX,
    updating: false,
  }
}

/** What is looked for on the tab "Themen": a theme, a colour of the picture, or both. */
export interface ThemeChoice {
  themeId?: string | undefined
  colour?: PictureColour | undefined
}

async function findTheme(choice: ThemeChoice, lang: CardLang, count: number, order: ThemeOrder): Promise<FoundCards> {
  const { themeId, colour } = choice
  const theme = themeId === undefined ? undefined : (await loadLookIndex()).themes.find((entry) => entry.id === themeId)
  if (themeId !== undefined && !theme) return { status: 'unknown' }
  // a theme: its cards as they fit, of the colour only where one is chosen;
  // a colour alone: the cards with the most of it
  const all = colour ? cardsOfColour(await loadColourIndex(), colour, theme?.cards).slice(0, THEME_MAX) : (theme?.cards ?? [])
  // by colour: the cards that fit best, laid out anew; not other cards
  const fitting = all.slice(0, count)
  const ids = order === 'colour' ? sortByColour(await loadColourIndex(), fitting) : fitting
  return { status: 'ready', cards: await cardsOf(ids, lang), hasMore: all.length > count, updating: false }
}

/**
 * What `find` finds. `group` names what is asked about and `key` how (how many, in which
 * order): while only the how changes, the cards of before stay in view.
 */
function useFound(group: string | undefined, key: string, find: () => Promise<FoundCards>): FoundCards {
  const [found, setFound] = useState<{ group: string; key: string; result: FoundCards }>()

  useEffect(() => {
    if (group === undefined) return
    let cancelled = false
    find().then(
      (result) => {
        if (!cancelled) setFound({ group, key, result })
      },
      () => {
        if (!cancelled) setFound({ group, key, result: { status: 'error' } })
      },
    )
    return () => {
      cancelled = true
    }
    // `find` belongs to group and key: the same ones ask for the same cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, key])

  if (!found || found.group !== group) return { status: 'loading' }
  if (found.key === key) return found.result
  return found.result.status === 'ready' ? { ...found.result, updating: true } : { status: 'loading' }
}

/** The `count` cards of the high rarities that look most like a card. */
export function useSimilarCards(cardId: string, lang: CardLang, count: number): FoundCards {
  return useFound(`similar:${lang}:${cardId}`, String(count), () => findSimilar(cardId, lang, count))
}

/** The `count` cards that fit a theme, a colour or both best; loading until one of them is chosen. */
export function useThemeCards(choice: ThemeChoice, lang: CardLang, count: number, order: ThemeOrder): FoundCards {
  const chosen = choice.themeId !== undefined || choice.colour !== undefined
  return useFound(chosen ? `theme:${lang}:${choice.themeId ?? ''}:${choice.colour ?? ''}` : undefined, `${count}:${order}`, () =>
    findTheme(choice, lang, count, order),
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
