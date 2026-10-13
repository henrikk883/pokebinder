import { OFFERED_LANGS, type CardLang } from '../../types/binder'

/** A card the collector noted while browsing, to decide on later. */
export interface SavedCard {
  cardId: string
  lang: CardLang
  /** ISO 8601; a list shows what was noted last first. */
  savedAt: string
  /** What the collector would pay for the card, in euros; only where one was set. */
  wishPrice?: number
}

/** A "Merkliste": cards noted for one purpose, e.g. a binder to come or things to buy. */
export interface Watchlist {
  id: string
  name: string
  cards: SavedCard[]
}

/**
 * The list the star on a card notes into. It is always there and always first; its name
 * comes from the UI texts, not from here.
 */
export const QUICK_LIST_ID = 'quick'

export function isSaved(cards: readonly SavedCard[], cardId: string, lang: CardLang): boolean {
  return cards.some((entry) => entry.cardId === cardId && entry.lang === lang)
}

/** Notes a card, or takes it off the list if it is on it. New entries come first. */
export function toggleSaved(
  cards: readonly SavedCard[],
  cardId: string,
  lang: CardLang,
  now: string,
): SavedCard[] {
  if (isSaved(cards, cardId, lang)) {
    return cards.filter((entry) => !(entry.cardId === cardId && entry.lang === lang))
  }
  return [{ cardId, lang, savedAt: now }, ...cards]
}

/** The same in one of several lists; an unknown list changes nothing. */
export function toggleInList(
  lists: readonly Watchlist[],
  listId: string,
  cardId: string,
  lang: CardLang,
  now: string,
): Watchlist[] {
  return lists.map((list) =>
    list.id === listId ? { ...list, cards: toggleSaved(list.cards, cardId, lang, now) } : list,
  )
}

/** Sets what the collector would pay for a card of a list, or takes that off (`undefined`). */
export function setWishPrice(
  lists: readonly Watchlist[],
  listId: string,
  cardId: string,
  lang: CardLang,
  wishPrice: number | undefined,
): Watchlist[] {
  return lists.map((list) =>
    list.id !== listId
      ? list
      : {
          ...list,
          cards: list.cards.map((card) => {
            if (card.cardId !== cardId || card.lang !== lang) return card
            const { wishPrice: _before, ...rest } = card
            void _before
            return wishPrice === undefined ? rest : { ...rest, wishPrice }
          }),
        },
  )
}

/**
 * Notes cards on a list; a card that is on it already stays as it is. The cards added come
 * first, in the order given. An unknown list changes nothing.
 */
export function addToList(
  lists: readonly Watchlist[],
  listId: string,
  cards: readonly Pick<SavedCard, 'cardId' | 'lang'>[],
  now: string,
): Watchlist[] {
  return lists.map((list) => {
    if (list.id !== listId) return list
    const added: SavedCard[] = []
    for (const { cardId, lang } of cards) {
      if (!isSaved(list.cards, cardId, lang) && !isSaved(added, cardId, lang)) added.push({ cardId, lang, savedAt: now })
    }
    return added.length === 0 ? list : { ...list, cards: [...added, ...list.cards] }
  })
}

/**
 * Where a card is noted in another language than `lang`: per language the ids of the lists.
 * A list notes a card in the language it was found in, so the same card looked at in
 * another language is not on that list, though the collector has it in mind.
 */
export function notedInOtherLangs(
  lists: readonly Watchlist[],
  cardId: string,
  lang: CardLang,
): { lang: CardLang; listIds: string[] }[] {
  return OFFERED_LANGS.filter((other) => other !== lang).flatMap((other) => {
    const listIds = listsWith(lists, cardId, other)
    return listIds.length > 0 ? [{ lang: other, listIds }] : []
  })
}

/** Ids of the lists a card is on. */
export function listsWith(lists: readonly Watchlist[], cardId: string, lang: CardLang): string[] {
  return lists.filter((list) => isSaved(list.cards, cardId, lang)).map((list) => list.id)
}

/** How many different cards are noted on all lists together. */
export function savedCardCount(lists: readonly Watchlist[]): number {
  return new Set(lists.flatMap((list) => list.cards.map((card) => `${card.lang}:${card.cardId}`))).size
}

/** Adds an empty list at the end; `undefined` for a name that is empty. */
export function addList(lists: readonly Watchlist[], id: string, name: string): Watchlist[] | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  return [...lists, { id, name: trimmed, cards: [] }]
}

/** Gives a list another name; an empty name and the quick list change nothing. */
export function renameList(lists: readonly Watchlist[], listId: string, name: string): Watchlist[] {
  const trimmed = name.trim()
  if (!trimmed || listId === QUICK_LIST_ID) return [...lists]
  return lists.map((list) => (list.id === listId ? { ...list, name: trimmed } : list))
}

/** Removes a list with what is on it; the quick list stays. */
export function removeList(lists: readonly Watchlist[], listId: string): Watchlist[] {
  if (listId === QUICK_LIST_ID) return [...lists]
  return lists.filter((list) => list.id !== listId)
}

/**
 * Brings the lists of another device together with those of this one. A list both have
 * keeps its name here and gets the cards it lacks; lists only the other has are added.
 * Nothing is taken off a list by this: what was removed on one device comes back.
 */
export function mergeWatchlists(local: readonly Watchlist[], incoming: readonly Watchlist[]): Watchlist[] {
  const merged = local.map((list) => {
    const other = incoming.find((entry) => entry.id === list.id)
    if (!other) return list
    const added = other.cards.filter((card) => !isSaved(list.cards, card.cardId, card.lang))
    return added.length === 0 ? list : { ...list, cards: [...list.cards, ...added] }
  })
  const unknown = incoming.filter((list) => !local.some((entry) => entry.id === list.id))
  return [...merged, ...unknown]
}

function parseCards(raw: unknown): SavedCard[] {
  if (!Array.isArray(raw)) return []
  const cards: SavedCard[] = []
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { cardId, lang, savedAt, wishPrice } = entry as {
      cardId?: unknown
      lang?: unknown
      savedAt?: unknown
      wishPrice?: unknown
    }
    const known = OFFERED_LANGS.find((offered) => offered === lang)
    if (typeof cardId !== 'string' || cardId === '' || !known || isSaved(cards, cardId, known)) continue
    const card: SavedCard = { cardId, lang: known, savedAt: typeof savedAt === 'string' ? savedAt : '' }
    if (typeof wishPrice === 'number' && Number.isFinite(wishPrice) && wishPrice > 0) card.wishPrice = wishPrice
    cards.push(card)
  }
  return cards
}

function parseJson(text: string | null): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Reads the single list of the time before there were several: just its cards. */
export function parseWatchlist(text: string | null): SavedCard[] {
  return parseCards(parseJson(text))
}

/**
 * Reads the stored lists. The quick list is always there and first. `legacy` is what was
 * stored when there was one list only: it becomes the quick list while nothing newer is
 * stored. Lists and cards that cannot be read are left out.
 */
export function parseWatchlists(text: string | null, legacy: string | null = null): Watchlist[] {
  const raw = parseJson(text)
  const quick: Watchlist = { id: QUICK_LIST_ID, name: '', cards: [] }
  if (!Array.isArray(raw)) return [{ ...quick, cards: parseWatchlist(legacy) }]

  const others: Watchlist[] = []
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, name, cards } = entry as { id?: unknown; name?: unknown; cards?: unknown }
    if (typeof id !== 'string' || id === '') continue
    if (id === QUICK_LIST_ID) {
      quick.cards = parseCards(cards)
      continue
    }
    if (typeof name !== 'string' || name.trim() === '' || others.some((list) => list.id === id)) continue
    others.push({ id, name: name.trim(), cards: parseCards(cards) })
  }
  return [quick, ...others]
}
