import { OFFERED_LANGS, type CardLang } from '../../types/binder'

/** A card the collector noted while browsing, to decide on later. */
export interface SavedCard {
  cardId: string
  lang: CardLang
  /** ISO 8601; the list shows what was noted last first. */
  savedAt: string
}

export function isSaved(list: readonly SavedCard[], cardId: string, lang: CardLang): boolean {
  return list.some((entry) => entry.cardId === cardId && entry.lang === lang)
}

/** Notes a card, or takes it off the list if it is on it. New entries come first. */
export function toggleSaved(
  list: readonly SavedCard[],
  cardId: string,
  lang: CardLang,
  now: string,
): SavedCard[] {
  if (isSaved(list, cardId, lang)) {
    return list.filter((entry) => !(entry.cardId === cardId && entry.lang === lang))
  }
  return [{ cardId, lang, savedAt: now }, ...list]
}

/** Reads a stored list; entries that cannot be read are left out, anything else gives an empty list. */
export function parseWatchlist(text: string | null): SavedCard[] {
  if (!text) return []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const list: SavedCard[] = []
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { cardId, lang, savedAt } = entry as { cardId?: unknown; lang?: unknown; savedAt?: unknown }
    const known = OFFERED_LANGS.find((offered) => offered === lang)
    if (typeof cardId !== 'string' || cardId === '' || !known || isSaved(list, cardId, known)) continue
    list.push({ cardId, lang: known, savedAt: typeof savedAt === 'string' ? savedAt : '' })
  }
  return list
}
