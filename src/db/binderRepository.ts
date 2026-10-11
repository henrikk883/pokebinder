import type { Asset, Binder } from '../types/binder'
import { db, type PokeBinderDatabase } from './database'

export function createBinderRepository(database: PokeBinderDatabase = db) {
  return {
    async saveBinder(binder: Binder): Promise<void> {
      await database.binders.put(binder)
    },

    loadBinder(id: string): Promise<Binder | undefined> {
      return database.binders.get(id)
    },

    /** Most recently changed binder first. */
    listBinders(): Promise<Binder[]> {
      return database.binders.orderBy('updatedAt').reverse().toArray()
    },

    async deleteBinder(id: string): Promise<void> {
      await database.binders.delete(id)
    },

    async saveAssets(assets: Asset[]): Promise<void> {
      await database.assets.bulkPut(assets)
    },

    /** Returns the assets that exist; unknown ids are skipped. */
    async loadAssets(ids: string[]): Promise<Asset[]> {
      const assets = await database.assets.bulkGet(ids)
      return assets.filter((asset) => asset !== undefined)
    },

    /** Writes a binder together with its assets, all or nothing. */
    async saveBinderWithAssets(binder: Binder, assets: Asset[]): Promise<void> {
      await database.transaction('rw', database.binders, database.assets, async () => {
        await database.assets.bulkPut(assets)
        await database.binders.put(binder)
      })
    },
  }
}

export type BinderRepository = ReturnType<typeof createBinderRepository>

export const binderRepository = createBinderRepository()
