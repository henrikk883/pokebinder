import { useEffect, useState } from 'react'
import { tcgdexFor, type CardDetail, type CardSummary } from '../../lib/tcgdex'
import { OFFERED_LANGS, type CardLang, type CardVariant } from '../../types/binder'

/** `null`: TCGdex does not know the card, or it could not be loaded. */
type Resolved = CardSummary | null

// Cards seen once render immediately afterwards, e.g. after turning the page back.
const resolved = new Map<string, Resolved>()
const keyOf = (cardId: string, lang: CardLang) => `${lang}:${cardId}`

/**
 * Name and image of a card a binder refers to, in the card's language.
 * `undefined` while loading, `null` when the card cannot be shown.
 */
export function useCard(cardId: string | undefined, lang: CardLang): Resolved | undefined {
  const [loaded, setLoaded] = useState<{ key: string; card: Resolved }>()
  const key = cardId === undefined ? undefined : keyOf(cardId, lang)

  useEffect(() => {
    if (cardId === undefined || key === undefined || resolved.has(key)) return
    let cancelled = false
    tcgdexFor(lang)
      .getCard(cardId)
      .then(
        (card) => {
          resolved.set(key, card ?? null)
          if (!cancelled) setLoaded({ key, card: card ?? null })
        },
        () => {
          // not remembered: the next attempt may succeed
          if (!cancelled) setLoaded({ key, card: null })
        },
      )
    return () => {
      cancelled = true
    }
  }, [cardId, lang, key])

  if (key === undefined) return undefined
  const known = resolved.get(key)
  if (known !== undefined) return known
  return loaded && loaded.key === key ? loaded.card : undefined
}

/**
 * Rarity and finishes of a card, for the selection column.
 * `undefined` while loading or when TCGdex has nothing on the card.
 */
export function useCardDetail(cardId: string | undefined, lang: CardLang): CardDetail | undefined {
  const [loaded, setLoaded] = useState<{ key: string; detail: CardDetail | undefined }>()
  const key = cardId === undefined ? undefined : keyOf(cardId, lang)

  useEffect(() => {
    if (cardId === undefined || key === undefined) return
    let cancelled = false
    tcgdexFor(lang)
      .getCardDetail(cardId)
      .then(
        (detail) => {
          if (!cancelled) setLoaded({ key, detail })
        },
        () => {
          if (!cancelled) setLoaded({ key, detail: undefined })
        },
      )
    return () => {
      cancelled = true
    }
  }, [cardId, lang, key])

  return loaded && loaded.key === key ? loaded.detail : undefined
}

/**
 * Cardmarket price of a card in one finish, in euros.
 * `undefined` while loading, `null` when there is no price.
 */
export function usePrice(
  cardId: string | undefined,
  variant: CardVariant | undefined,
  lang: CardLang,
): number | null | undefined {
  const [loaded, setLoaded] = useState<{ key: string; price: number | null }>()
  const key = cardId === undefined || variant === undefined ? undefined : `${keyOf(cardId, lang)}:${variant}`

  useEffect(() => {
    if (cardId === undefined || variant === undefined || key === undefined) return
    let cancelled = false
    tcgdexFor(lang)
      .getPrice(cardId, variant)
      .then(
        (price) => {
          if (!cancelled) setLoaded({ key, price: price?.amount ?? null })
        },
        () => {
          if (!cancelled) setLoaded({ key, price: null })
        },
      )
    return () => {
      cancelled = true
    }
  }, [cardId, variant, lang, key])

  return loaded && loaded.key === key ? loaded.price : undefined
}

/**
 * The languages a card with this id exists in. Western sets share their ids, so a German
 * card usually exists in English too; Japanese sets have ids of their own.
 * Until the answer is there, only the card's current language is offered.
 */
export function useCardLangs(cardId: string | undefined, current: CardLang): CardLang[] {
  const [loaded, setLoaded] = useState<{ cardId: string; langs: CardLang[] }>()

  useEffect(() => {
    if (cardId === undefined) return
    let cancelled = false
    Promise.all(
      OFFERED_LANGS.map(async (lang) => {
        const card = await tcgdexFor(lang)
          .getCard(cardId)
          .catch(() => undefined)
        return card ? [lang] : []
      }),
    ).then((found) => {
      if (!cancelled) setLoaded({ cardId, langs: found.flat() })
    })
    return () => {
      cancelled = true
    }
  }, [cardId])

  const langs = loaded && loaded.cardId === cardId ? loaded.langs : []
  return OFFERED_LANGS.filter((lang) => lang === current || langs.includes(lang))
}
