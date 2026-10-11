import Dexie, { type Table } from 'dexie'
import type { CachedResponse } from '../lib/tcgdex/cache'
import type { Asset, Binder } from '../types/binder'

export class PokeBinderDatabase extends Dexie {
  binders!: Table<Binder, string>
  assets!: Table<Asset, string>
  apiCache!: Table<CachedResponse, string>

  constructor(name = 'pokebinder') {
    super(name)
    this.version(1).stores({
      binders: 'id, updatedAt',
      assets: 'id',
    })
    this.version(2).stores({
      apiCache: 'key',
    })
  }
}

export const db = new PokeBinderDatabase()
