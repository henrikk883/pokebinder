import Dexie, { type Table } from 'dexie'
import type { Asset, Binder } from '../types/binder'

export class PokeBinderDatabase extends Dexie {
  binders!: Table<Binder, string>
  assets!: Table<Asset, string>

  constructor(name = 'pokebinder') {
    super(name)
    this.version(1).stores({
      binders: 'id, updatedAt',
      assets: 'id',
    })
  }
}

export const db = new PokeBinderDatabase()
