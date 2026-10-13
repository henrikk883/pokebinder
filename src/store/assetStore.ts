import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { binderRepository } from '../db/binderRepository'
import { deckRepository } from '../db/deckRepository'
import { assetUses, type AssetUse } from '../features/images/assetUses'
import type { Asset } from '../types/binder'
import { binderStore } from './binderStore'

/** The image library: uploaded images, shared by all binders. */
export interface AssetState {
  assets: Asset[]
  /** Reads the library from the database, e.g. at start or after a backup import. */
  load: () => Promise<void>
  add: (assets: Asset[]) => Promise<void>
  /**
   * Deletes an image. While a binder or a deck box still shows it, it stays, and the places
   * it is shown at are given back; an empty list says that it is gone.
   */
  remove: (assetId: string) => Promise<AssetUse[]>
}

export const assetStore = createStore<AssetState>()((set, get) => ({
  assets: [],

  load: async () => {
    set({ assets: await binderRepository.listAssets() })
  },

  add: async (assets) => {
    await binderRepository.saveAssets(assets)
    await get().load()
  },

  remove: async (assetId) => {
    await binderStore.getState().whenSaved()
    const binders = await binderRepository.listBinders()
    const decks = await deckRepository.listDecks().catch(() => [])
    const uses = assetUses(binders, decks, assetId)
    if (uses.length > 0) return uses
    await binderRepository.deleteAsset(assetId)
    releaseUrl(assetId)
    await get().load()
    return []
  },
}))

export function useAssetStore<T>(selector: (state: AssetState) => T): T {
  return useStore(assetStore, selector)
}

// One object URL per image for as long as the image exists.
const urls = new Map<string, string>()

function releaseUrl(assetId: string): void {
  const url = urls.get(assetId)
  if (url) URL.revokeObjectURL(url)
  urls.delete(assetId)
}

/** Address under which the browser can show an image of the library. */
export function assetUrl(asset: Asset): string {
  let url = urls.get(asset.id)
  if (!url) {
    url = URL.createObjectURL(asset.blob)
    urls.set(asset.id, url)
  }
  return url
}

/** URL of a library image by id; `undefined` while the library loads or if the image is gone. */
export function useAssetUrl(assetId: string | undefined): string | undefined {
  const asset = useAssetStore((state) =>
    assetId === undefined ? undefined : state.assets.find((entry) => entry.id === assetId),
  )
  return asset ? assetUrl(asset) : undefined
}
