import type { Deck } from '../types/deck'
import { db, type PokeBinderDatabase } from './database'

export function createDeckRepository(database: PokeBinderDatabase = db) {
  return {
    async saveDeck(deck: Deck): Promise<void> {
      await database.decks.put(deck)
    },

    async loadDeck(id: string): Promise<Deck | undefined> {
      return database.decks.get(id)
    },

    /** Most recently changed deck first. */
    async listDecks(): Promise<Deck[]> {
      return database.decks.orderBy('updatedAt').reverse().toArray()
    },

    async deleteDeck(id: string): Promise<void> {
      await database.decks.delete(id)
    },
  }
}

export type DeckRepository = ReturnType<typeof createDeckRepository>

export const deckRepository = createDeckRepository()
