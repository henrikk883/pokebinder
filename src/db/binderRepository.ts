import { DEFAULT_LANG, type Asset, type Binder } from '../types/binder'
import { db, type PokeBinderDatabase } from './database'

/** Binders stored by earlier versions lack fields added since; they are filled in on reading. */
function upgrade(binder: Binder): Binder {
  const stored = binder as Omit<Binder, 'lang'> & Partial<Pick<Binder, 'lang'>>
  return stored.lang === undefined ? { ...binder, lang: DEFAULT_LANG } : binder
}

export function createBinderRepository(database: PokeBinderDatabase = db) {
  return {
    async saveBinder(binder: Binder): Promise<void> {
      await database.binders.put(binder)
    },

    async loadBinder(id: string): Promise<Binder | undefined> {
      const binder = await database.binders.get(id)
      return binder && upgrade(binder)
    },

    /** Most recently changed binder first. */
    async listBinders(): Promise<Binder[]> {
      const binders = await database.binders.orderBy('updatedAt').reverse().toArray()
      return binders.map(upgrade)
    },

    async deleteBinder(id: string): Promise<void> {
      await database.binders.delete(id)
    },

    async saveAssets(assets: Asset[]): Promise<void> {
      await database.assets.bulkPut(assets)
    },

    /** The image library: every stored image, oldest first. */
    async listAssets(): Promise<Asset[]> {
      const assets = await database.assets.toArray()
      return assets.sort(
        (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id),
      )
    },

    /** Which images are stored, without reading them. */
    async listAssetIds(): Promise<string[]> {
      return database.assets.toCollection().primaryKeys()
    },

    async deleteAsset(id: string): Promise<void> {
      await database.assets.delete(id)
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
