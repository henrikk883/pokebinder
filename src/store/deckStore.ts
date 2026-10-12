import { create } from 'zustand'
import { deckRepository } from '../db/deckRepository'
import type { Deck } from '../types/deck'

interface DeckState {
  /** The deck that lies open, if any. */
  deck: Deck | null
  /** Shows a deck that is already stored; does not write. */
  openDeck: (deck: Deck) => void
  closeDeck: () => void
  /** Stores a new deck and opens it. */
  adoptDeck: (deck: Deck) => void
  /** Changes the open deck and stores the result. */
  change: (update: (deck: Deck) => Deck) => void
  /** Resolves once every change made so far has been written (or failed). */
  whenSaved: () => Promise<void>
}

export const useDeckStore = create<DeckState>()((set, get) => {
  // one write after the other, so that the last change is what stays
  let pending: Promise<void> = Promise.resolve()
  const save = (deck: Deck) => {
    pending = pending.then(() => deckRepository.saveDeck(deck)).catch(() => undefined)
  }

  return {
    deck: null,
    openDeck: (deck) => set({ deck }),
    closeDeck: () => set({ deck: null }),
    adoptDeck: (deck) => {
      set({ deck })
      save(deck)
    },
    change: (update) => {
      const { deck } = get()
      if (!deck) return
      const next = update(deck)
      if (next === deck) return
      set({ deck: next })
      save(next)
    },
    whenSaved: () => pending,
  }
})
