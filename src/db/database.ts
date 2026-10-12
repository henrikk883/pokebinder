import Dexie, { type Table } from 'dexie'
import type { CachedResponse } from '../lib/tcgdex/cache'
import type { Asset, Binder } from '../types/binder'
import type { Deck } from '../types/deck'

export class PokeBinderDatabase extends Dexie {
  binders!: Table<Binder, string>
  assets!: Table<Asset, string>
  apiCache!: Table<CachedResponse, string>
  decks!: Table<Deck, string>

  constructor(name = 'pokebinder') {
    super(name)
    this.version(1).stores({
      binders: 'id, updatedAt',
      assets: 'id',
    })
    this.version(2).stores({
      apiCache: 'key',
    })
    this.version(3).stores({
      decks: 'id, updatedAt',
    })
  }
}

export const db = new PokeBinderDatabase()
