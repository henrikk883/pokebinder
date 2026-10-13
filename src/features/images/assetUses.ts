import type { Binder } from '../../types/binder'
import type { Deck } from '../../types/deck'

/** A place an uploaded image is shown at; while there is one, the image is not deleted. */
export type AssetUse =
  | { kind: 'cover'; binder: string }
  /** Behind the pockets of a page; `page` counts from 1. */
  | { kind: 'page'; binder: string; page: number }
  | { kind: 'deck'; deck: string }

/**
 * Where an image of the library is in use: on the cover of a binder, behind the pockets of
 * its pages (each page once), on the box of a deck. In the order of the binders, then the
 * decks. Empty for an image nothing shows.
 */
export function assetUses(binders: readonly Binder[], decks: readonly Deck[], assetId: string): AssetUse[] {
  const uses: AssetUse[] = []
  for (const binder of binders) {
    if (binder.cover.assetId === assetId) uses.push({ kind: 'cover', binder: binder.name })
    for (const page of binder.pages) {
      if (page.images.some((image) => image.assetId === assetId)) {
        uses.push({ kind: 'page', binder: binder.name, page: page.index + 1 })
      }
    }
  }
  for (const deck of decks) {
    if (deck.coverAssetId === assetId) uses.push({ kind: 'deck', deck: deck.name })
  }
  return uses
}
