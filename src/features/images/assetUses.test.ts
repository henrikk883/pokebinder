import { describe, expect, it } from 'vitest'
import type { Binder, Page } from '../../types/binder'
import type { Deck } from '../../types/deck'
import { assetUses } from './assetUses'

const page = (index: number, assetIds: string[]): Page => ({
  id: `p${index}`,
  index,
  openingSide: 'left',
  slots: [],
  images: assetIds.map((assetId, i) => ({ id: `i${index}-${i}`, assetId, fromSlot: 0, spanCols: 1, spanRows: 1, crop: { x: 0.5, y: 0.5, zoom: 1 } })),
})
const binder = (name: string, cover: string | undefined, pages: string[][]): Binder => ({
  id: name,
  name,
  mode: 'empty',
  withReverseHolo: false,
  withSecretRares: true,
  withPromos: true,
  layout: '3x3',
  lang: 'de',
  defaultOpeningSide: 'right',
  cover: cover === undefined ? { title: name } : { title: name, assetId: cover },
  pages: pages.map((ids, index) => page(index, ids)),
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
})
const deck = (name: string, coverAssetId?: string): Deck => ({
  id: name,
  name,
  format: 'standard',
  cards: [],
  ...(coverAssetId === undefined ? {} : { coverAssetId }),
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
})

describe('assetUses', () => {
  const binders = [binder('Kanto', 'forest', [['sunset'], [], ['forest', 'forest']]), binder('Johto', undefined, [['forest']])]
  const decks = [deck('Feuer', 'forest'), deck('Wasser')]

  it('names the cover, the pages and the deck boxes an image is shown at', () => {
    expect(assetUses(binders, decks, 'forest')).toEqual([
      { kind: 'cover', binder: 'Kanto' },
      // twice on a page is one place
      { kind: 'page', binder: 'Kanto', page: 3 },
      { kind: 'page', binder: 'Johto', page: 1 },
      { kind: 'deck', deck: 'Feuer' },
    ])
    expect(assetUses(binders, decks, 'sunset')).toEqual([{ kind: 'page', binder: 'Kanto', page: 1 }])
  })

  it('knows of no place for an image nothing shows', () => {
    expect(assetUses(binders, decks, 'unused')).toEqual([])
    expect(assetUses([], [], 'forest')).toEqual([])
  })
})
