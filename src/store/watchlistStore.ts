import { create } from 'zustand'
import { parseWatchlist, toggleSaved, type SavedCard } from '../features/search/watchlist'
import type { CardLang } from '../types/binder'

// Kept in this browser like the order of the shelf; it is not part of a backup.
const WATCHLIST_KEY = 'pokebinder:watchlist'

function readStored(): SavedCard[] {
  try {
    return parseWatchlist(localStorage.getItem(WATCHLIST_KEY))
  } catch {
    return []
  }
}

/** The "Merkliste": cards noted while browsing, across all binders. */
export interface WatchlistState {
  cards: SavedCard[]
  /** Notes a card, or takes it off the list if it is on it. */
  toggle: (cardId: string, lang: CardLang) => void
}

export const useWatchlistStore = create<WatchlistState>()((set, get) => ({
  cards: readStored(),
  toggle: (cardId, lang) => {
    const cards = toggleSaved(get().cards, cardId, lang, new Date().toISOString())
    set({ cards })
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(cards))
    } catch {
      // without storage the list simply lasts until the app is closed
    }
  },
}))
