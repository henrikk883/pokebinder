import { create } from 'zustand'
import {
  addList,
  parseWatchlists,
  QUICK_LIST_ID,
  removeList,
  renameList,
  toggleInList,
  type Watchlist,
} from '../features/search/watchlist'
import { newId } from '../lib/id'
import type { CardLang } from '../types/binder'

// Kept in this browser like the order of the shelf; it is not part of a backup.
const WATCHLISTS_KEY = 'pokebinder:watchlists'
/** Where the one list of earlier versions was kept; it becomes the quick list. */
const LEGACY_KEY = 'pokebinder:watchlist'

function readStored(): Watchlist[] {
  try {
    return parseWatchlists(localStorage.getItem(WATCHLISTS_KEY), localStorage.getItem(LEGACY_KEY))
  } catch {
    return parseWatchlists(null)
  }
}

function store(lists: Watchlist[]): void {
  try {
    localStorage.setItem(WATCHLISTS_KEY, JSON.stringify(lists))
  } catch {
    // without storage the lists simply last until the app is closed
  }
}

/** The "Merklisten": cards noted while browsing, across all binders. */
export interface WatchlistState {
  /** The quick list first, then the collector's own lists in the order they were made. */
  lists: Watchlist[]
  /** The list shown beside the binder and on the page "Karten". */
  activeListId: string
  showList: (listId: string) => void
  /** Notes a card on a list, or takes it off if it is on it. */
  toggle: (listId: string, cardId: string, lang: CardLang) => void
  /** Makes a new list and returns its id; `undefined` for an empty name. */
  create: (name: string) => string | undefined
  rename: (listId: string, name: string) => void
  /** Removes a list with what is on it; the quick list cannot be removed. */
  remove: (listId: string) => void
}

export const useWatchlistStore = create<WatchlistState>()((set, get) => {
  function update(lists: Watchlist[]) {
    set({ lists })
    store(lists)
  }

  return {
    lists: readStored(),
    activeListId: QUICK_LIST_ID,
    showList: (activeListId) => set({ activeListId }),
    toggle: (listId, cardId, lang) =>
      update(toggleInList(get().lists, listId, cardId, lang, new Date().toISOString())),
    create: (name) => {
      const id = newId()
      const lists = addList(get().lists, id, name)
      if (!lists) return undefined
      update(lists)
      return id
    },
    rename: (listId, name) => update(renameList(get().lists, listId, name)),
    remove: (listId) => {
      update(removeList(get().lists, listId))
      if (get().activeListId === listId) set({ activeListId: QUICK_LIST_ID })
    },
  }
})

// the same object every time, as a store selector must give for an unchanged state
const NO_LIST: Watchlist = { id: QUICK_LIST_ID, name: '', cards: [] }

/** The list that is shown; the quick list if the chosen one is gone. */
export function useActiveList(): Watchlist {
  return useWatchlistStore(
    (state) =>
      state.lists.find((list) => list.id === state.activeListId) ??
      state.lists.find((list) => list.id === QUICK_LIST_ID) ??
      NO_LIST,
  )
}
