// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { readBinder, readDeck } from '../src/features/export/backup'
import { createBinder, renameBinder } from '../src/features/binder/binderModel'
import { QUICK_LIST_ID, type Watchlist } from '../src/features/search/watchlist'
import { createSyncApi, SignedOutError, type Send } from '../src/features/sync/syncApi'
import { runSync, type SyncDeps } from '../src/features/sync/syncRun'
import {
  EMPTY_SYNC_STATE,
  withDeleted,
  withDeletedDeck,
  withListsChanged,
  type SyncState,
} from '../src/features/sync/syncState'
import { addCard, createDeck, renameDeck, setDeckCover } from '../src/features/decks/deckModel'
import { placeImage, setCover } from '../src/features/images/imageModel'
import type { Asset, Binder } from '../src/types/binder'
import type { Deck } from '../src/types/deck'
import { handleApi } from './api'
import { createD1Store } from './d1Store'
import type { SyncStore } from './store'
import { createTestBucket, createTestDatabase } from './testing'

// The app's side of the sync against the real server part: two devices of one collector,
// each with its own binders, lists and memory of the last sync.

const ASH = 'ash@example.com'
let server: SyncStore
let clock: number

/** A time later than every one handed out before. */
const tick = () => new Date(Date.UTC(2026, 9, 12, 10, 0, clock++)).toISOString()

interface Device {
  binders: Map<string, Binder>
  decks: Map<string, Deck>
  assets: Map<string, Asset>
  lists: Watchlist[]
  state: SyncState
  deps: SyncDeps
  sync: (decisions?: Parameters<typeof runSync>[2]) => ReturnType<typeof runSync>
  /** What the collector does on this device. */
  create: (name: string) => Binder
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  note: (cardId: string) => void
  names: () => string[]
}

function device(user = ASH, send?: Send): Device {
  const self: Device = {
    binders: new Map(),
    decks: new Map(),
    assets: new Map(),
    lists: [{ id: QUICK_LIST_ID, name: '', cards: [] }],
    state: EMPTY_SYNC_STATE,
    deps: {
      api: createSyncApi(
        send ?? ((path, init) => handleApi(new Request(`https://pokebinder.example${path}`, init), user, server)),
      ),
      binders: {
        list: () => Promise.resolve([...self.binders.values()]),
        load: (id) => Promise.resolve(self.binders.get(id)),
        save: (binder) => Promise.resolve(void self.binders.set(binder.id, binder)),
        remove: (id) => Promise.resolve(void self.binders.delete(id)),
      },
      decks: {
        list: () => Promise.resolve([...self.decks.values()]),
        load: (id) => Promise.resolve(self.decks.get(id)),
        save: (deck) => Promise.resolve(void self.decks.set(deck.id, deck)),
        remove: (id) => Promise.resolve(void self.decks.delete(id)),
      },
      readDeck,
      assets: {
        ids: () => Promise.resolve([...self.assets.keys()]),
        load: (ids) => Promise.resolve(ids.flatMap((id) => self.assets.get(id) ?? [])),
        save: (assets) => Promise.resolve(assets.forEach((asset) => self.assets.set(asset.id, asset))),
      },
      readBinder,
      lists: {
        get: () => self.lists,
        replace: (lists) => {
          self.lists = lists
        },
      },
      state: {
        read: () => self.state,
        write: (state) => {
          self.state = state
        },
      },
      now: tick,
    },
    sync: (decisions) => runSync(self.deps, user, decisions),
    create: (name) => {
      const binder = { ...createBinder({ name, layout: '3x3' }), updatedAt: tick() }
      self.binders.set(binder.id, binder)
      return binder
    },
    rename: (id, name) => {
      const binder = self.binders.get(id)
      if (binder) self.binders.set(id, { ...renameBinder(binder, name), updatedAt: tick() })
    },
    remove: (id) => {
      self.binders.delete(id)
      self.state = withDeleted(self.state, id)
    },
    note: (cardId) => {
      self.lists = self.lists.map((list) =>
        list.id === QUICK_LIST_ID ? { ...list, cards: [...list.cards, { cardId, lang: 'de', savedAt: tick() }] } : list,
      )
      self.state = withListsChanged(self.state, tick())
    },
    names: () => [...self.binders.values()].map((binder) => binder.name).sort(),
  }
  return self
}

const noted = (target: Device) => target.lists.flatMap((list) => list.cards.map((card) => card.cardId)).sort()

const picture = (id: string, bytes: number[], mimeType = 'image/png'): Asset => ({
  id,
  blob: new Blob([new Uint8Array(bytes)], { type: mimeType }),
  mimeType,
  width: 300,
  height: 200,
  createdAt: '2026-10-01T08:00:00.000Z',
})

const bytesOf = async (asset: Asset | undefined) => (asset ? [...new Uint8Array(await asset.blob.arrayBuffer())] : [])

/** Puts an image of the device's library behind a pocket of a binder's first page. */
function place(target: Device, binderId: string, asset: Asset, fromSlot = 0): void {
  target.assets.set(asset.id, asset)
  const binder = target.binders.get(binderId)
  const page = binder?.pages[0]
  if (!binder || !page) throw new Error('no page')
  const placed = placeImage(binder, page.id, asset.id, { fromSlot, spanCols: 1, spanRows: 1 })
  if (!placed.ok) throw new Error(placed.error)
  target.binders.set(binderId, { ...placed.binder, updatedAt: tick() })
}

beforeEach(() => {
  server = createD1Store(createTestDatabase(), createTestBucket())
  clock = 0
})

describe('binders between two devices', () => {
  it('brings a binder made on one device to the other, whole', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')

    await pc.sync()
    const result = await phone.sync()

    expect(result).toEqual({ conflicts: [], changed: [kanto.id], changedDecks: [], imagesFetched: 0 })
    expect(phone.binders.get(kanto.id)).toEqual(kanto)
    // and then there is nothing left to do on either side
    expect(await pc.sync()).toEqual({ conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 })
    expect(await phone.sync()).toEqual({ conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 })
  })

  it('carries a change from the device it was made on to the other', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()

    phone.rename(kanto.id, 'Kanto komplett')
    await phone.sync()
    await pc.sync()

    expect(pc.names()).toEqual(['Kanto komplett'])
  })

  it('brings together binders made on both devices', async () => {
    const pc = device()
    const phone = device()
    pc.create('Kanto')
    phone.create('Johto')

    await pc.sync()
    await phone.sync()
    await pc.sync()

    expect(pc.names()).toEqual(['Johto', 'Kanto'])
    expect(phone.names()).toEqual(['Johto', 'Kanto'])
  })

  it('removes a binder everywhere once it was deleted on one device', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()

    pc.remove(kanto.id)
    await pc.sync()
    const result = await phone.sync()

    expect(result.changed).toEqual([kanto.id])
    expect(phone.names()).toEqual([])
    expect(pc.state.deleted).toEqual([])
    // it does not come back from anywhere
    await pc.sync()
    await phone.sync()
    expect(pc.names()).toEqual([])
  })

  it('keeps a binder that was worked on elsewhere while it was deleted here', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()

    pc.remove(kanto.id)
    phone.rename(kanto.id, 'Kanto vom Handy')
    await phone.sync()
    await pc.sync()

    expect(pc.names()).toEqual(['Kanto vom Handy'])
  })

  it('asks when a binder was changed on both devices, and does as it is told', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()

    pc.rename(kanto.id, 'Vom PC')
    phone.rename(kanto.id, 'Vom Handy')
    await pc.sync()
    const asked = await phone.sync()

    expect(asked.changed).toEqual([])
    expect(asked.conflicts).toMatchObject([{ id: kanto.id, name: 'Vom Handy' }])
    expect(phone.names()).toEqual(['Vom Handy'])
    // until it is decided, the question comes up again and nothing is overwritten
    expect((await phone.sync()).conflicts).toHaveLength(1)
    await pc.sync()
    expect(pc.names()).toEqual(['Vom PC'])

    expect(await phone.sync({ [kanto.id]: 'local' })).toEqual({ conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 })
    await pc.sync()
    expect(pc.names()).toEqual(['Vom Handy'])
  })

  it('takes the version of the other device when that is what was decided', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()
    pc.rename(kanto.id, 'Vom PC')
    phone.rename(kanto.id, 'Vom Handy')
    await pc.sync()

    const result = await phone.sync({ [kanto.id]: 'remote' })

    expect(result).toEqual({ conflicts: [], changed: [kanto.id], changedDecks: [], imagesFetched: 0 })
    expect(phone.names()).toEqual(['Vom PC'])
    expect(await phone.sync()).toEqual({ conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 })
  })

  it('asks about a binder both devices already had before they ever synced', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    // brought over with a backup file earlier, then worked on
    phone.binders.set(kanto.id, { ...kanto, name: 'Kanto alt', updatedAt: tick() })

    await pc.sync()

    expect((await phone.sync()).conflicts).toHaveLength(1)
  })

  it('leaves alone what the server has that is no binder', async () => {
    const pc = device()
    const phone = device()
    await server.putBinder(ASH, 'odd', tick(), JSON.stringify({ id: 'odd', updatedAt: 'x', pages: 'none' }), null)
    pc.create('Kanto')
    await pc.sync()

    const result = await phone.sync()

    expect(phone.names()).toEqual(['Kanto'])
    expect(result.changed).toHaveLength(1)
  })

  it('keeps the binders of one collector from another', async () => {
    const ash = device()
    const misty = device('misty@example.com')
    ash.create('Kanto')
    await ash.sync()

    await misty.sync()

    expect(misty.names()).toEqual([])
  })

  it('starts afresh when another collector signs in on the device', async () => {
    const shared = device()
    shared.create('Kanto')
    await shared.sync()

    await runSync(shared.deps, 'misty@example.com')

    expect(shared.state.user).toBe('misty@example.com')
    // nothing is deleted for that: the binder on the device now belongs to both
    expect(shared.names()).toEqual(['Kanto'])
  })
})

describe('decks between two devices', () => {
  /** A deck built on a device, with a few cards in it. */
  function build(target: Device, name: string): Deck {
    const deck = { ...addCard(addCard(createDeck(name), 'sv03.5-025', 'de', 4), 'sv03.5-026', 'de', 2), updatedAt: tick() }
    target.decks.set(deck.id, deck)
    return deck
  }
  const change = (target: Device, id: string, name: string) => {
    const deck = target.decks.get(id)
    if (deck) target.decks.set(id, { ...renameDeck(deck, name), updatedAt: tick() })
  }
  const deckNames = (target: Device) => [...target.decks.values()].map((deck) => deck.name).sort()

  it('brings a deck built on one device to the other, whole', async () => {
    const pc = device()
    const phone = device()
    const donner = build(pc, 'Donner')

    await pc.sync()
    const result = await phone.sync()

    expect(result).toEqual({ conflicts: [], changed: [], changedDecks: [donner.id], imagesFetched: 0 })
    expect(phone.decks.get(donner.id)).toEqual(donner)
    expect(await phone.sync()).toEqual({ conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 })
  })

  it('carries changes and deletions across, apart from the binders', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    const donner = build(pc, 'Donner')
    await pc.sync()
    await phone.sync()

    change(phone, donner.id, 'Blitz')
    await phone.sync()
    await pc.sync()
    expect(deckNames(pc)).toEqual(['Blitz'])

    pc.decks.delete(donner.id)
    pc.state = withDeletedDeck(pc.state, donner.id)
    await pc.sync()
    const result = await phone.sync()

    expect(result.changedDecks).toEqual([donner.id])
    expect(deckNames(phone)).toEqual([])
    expect(pc.state.deletedDecks).toEqual([])
    // the binder is untouched by all that
    expect(phone.binders.get(kanto.id)).toEqual(kanto)
  })

  it('asks when a deck was changed on both devices, saying that it is a deck', async () => {
    const pc = device()
    const phone = device()
    const donner = build(pc, 'Donner')
    await pc.sync()
    await phone.sync()

    change(pc, donner.id, 'Vom PC')
    change(phone, donner.id, 'Vom Handy')
    await pc.sync()
    const asked = await phone.sync()

    expect(asked.conflicts).toMatchObject([{ id: donner.id, kind: 'deck', name: 'Vom Handy' }])
    expect(deckNames(phone)).toEqual(['Vom Handy'])

    await phone.sync({ [donner.id]: 'remote' })
    expect(deckNames(phone)).toEqual(['Vom PC'])
  })

  it('brings the picture of the deck box along', async () => {
    const pc = device()
    const phone = device()
    const donner = build(pc, 'Donner')
    pc.assets.set('box', picture('box', [7, 7, 7]))
    pc.decks.set(donner.id, { ...setDeckCover(donner, 'box'), updatedAt: tick() })

    await pc.sync()
    const result = await phone.sync()

    expect(result.imagesFetched).toBe(1)
    expect(await bytesOf(phone.assets.get('box'))).toEqual([7, 7, 7])
  })

  it('leaves alone what the server has that is no deck', async () => {
    const phone = device()
    await server.putDeck(ASH, 'odd', tick(), JSON.stringify({ id: 'odd', updatedAt: 'x', cards: 'none' }), null)

    expect((await phone.sync()).changedDecks).toEqual([])
    expect(deckNames(phone)).toEqual([])
  })
})

describe('images between two devices', () => {
  it('brings an image along with the binder it lies in, as it was', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    place(pc, kanto.id, picture('forest', [137, 80, 78, 71, 1, 2, 3]))

    await pc.sync()
    const result = await phone.sync()

    expect(result.imagesFetched).toBe(1)
    const arrived = phone.assets.get('forest')
    expect(arrived).toMatchObject({ id: 'forest', mimeType: 'image/png', width: 300, height: 200, createdAt: '2026-10-01T08:00:00.000Z' })
    expect(await bytesOf(arrived)).toEqual([137, 80, 78, 71, 1, 2, 3])
    // once is enough
    expect((await phone.sync()).imagesFetched).toBe(0)
  })

  it('brings the picture on the cover as well', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    pc.assets.set('cover', picture('cover', [1, 2, 3], 'image/jpeg'))
    pc.binders.set(kanto.id, { ...setCover(kanto, { title: 'Kanto', assetId: 'cover' }), updatedAt: tick() })

    await pc.sync()
    await phone.sync()

    expect(await bytesOf(phone.assets.get('cover'))).toEqual([1, 2, 3])
  })

  it('leaves an image that no binder uses on the device it is on', async () => {
    const pc = device()
    const phone = device()
    pc.create('Kanto')
    pc.assets.set('unused', picture('unused', [9]))

    await pc.sync()
    await phone.sync()

    expect(await server.listAssets(ASH)).toEqual([])
    expect([...phone.assets.keys()]).toEqual([])
  })

  it('sends an image that is put into a binder later, and copes with one that is gone', async () => {
    const pc = device()
    const phone = device()
    const kanto = pc.create('Kanto')
    await pc.sync()
    await phone.sync()

    place(pc, kanto.id, picture('late', [4, 5]))
    place(pc, kanto.id, picture('lost', [6]), 1)
    // deleted from the library by other means: the binder still names it
    pc.assets.delete('lost')
    await pc.sync()
    const result = await phone.sync()

    expect(result).toMatchObject({ changed: [kanto.id], imagesFetched: 1 })
    expect([...phone.assets.keys()]).toEqual(['late'])
  })

  it('does not even send what the server would not take', async () => {
    const pc = device()
    const kanto = pc.create('Kanto')
    let sent = 0
    pc.deps.api = createSyncApi((path, init) => {
      if (path.startsWith('/api/assets/') && init?.method === 'PUT') sent++
      return handleApi(new Request(`https://pokebinder.example${path}`, init), ASH, server)
    })
    place(pc, kanto.id, picture('moving', [71, 73, 70], 'image/gif'))

    await pc.sync()
    await pc.sync()

    expect(sent).toBe(0)
    expect(await server.listAssets(ASH)).toEqual([])
    // the binder itself is synced all the same
    expect(await server.listBinders(ASH)).toHaveLength(1)
  })

  it('keeps the images of one collector from another', async () => {
    const ash = device()
    const misty = device('misty@example.com')
    const kanto = ash.create('Kanto')
    place(ash, kanto.id, picture('forest', [1]))
    await ash.sync()
    // the same binder on the other collector's device, e.g. from a backup file passed on
    const copy = ash.binders.get(kanto.id)
    if (copy) misty.binders.set(copy.id, copy)

    await misty.sync()

    expect([...misty.assets.keys()]).toEqual([])
  })
})

describe('lists between two devices', () => {
  it('brings what was noted on one device to the other', async () => {
    const pc = device()
    const phone = device()
    pc.note('sv03.5-025')

    await pc.sync()
    await phone.sync()

    expect(noted(phone)).toEqual(['sv03.5-025'])
    expect(pc.state.listsChangedAt).toBeNull()
  })

  it('takes a card off everywhere once it was taken off on one device', async () => {
    const pc = device()
    const phone = device()
    pc.note('sv03.5-025')
    await pc.sync()
    await phone.sync()

    phone.lists = phone.lists.map((list) => ({ ...list, cards: [] }))
    phone.state = withListsChanged(phone.state, tick())
    await phone.sync()
    await pc.sync()

    expect(noted(pc)).toEqual([])
  })

  it('keeps what was noted on both devices', async () => {
    const pc = device()
    const phone = device()
    pc.note('sv03.5-025')
    phone.note('sv03.5-006')

    await pc.sync()
    await phone.sync()
    await pc.sync()

    expect(noted(pc)).toEqual(['sv03.5-006', 'sv03.5-025'])
    expect(noted(phone)).toEqual(['sv03.5-006', 'sv03.5-025'])
    // settled: nothing more is sent
    const before = pc.state
    await pc.sync()
    expect(pc.state).toEqual(before)
  })

  it('sends nothing while there is nothing noted anywhere', async () => {
    const pc = device()

    await pc.sync()

    expect(await server.getWatchlists(ASH)).toBeUndefined()
  })
})

describe('when the server cannot be used', () => {
  it('says so when the collector has to sign in again, and keeps everything', async () => {
    const redirect = () => Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://sign.in' } }))
    const pc = device(ASH, redirect)
    pc.create('Kanto')

    await expect(pc.sync()).rejects.toBeInstanceOf(SignedOutError)
    expect(pc.names()).toEqual(['Kanto'])
    expect(await pc.deps.api.session()).toEqual({ kind: 'signedOut' })
  })

  it('tells being offline from there being no server part', async () => {
    const offline = createSyncApi(() => Promise.reject(new TypeError('Failed to fetch')))
    const appOnly = createSyncApi(() =>
      Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })),
    )

    expect(await offline.session()).toEqual({ kind: 'offline' })
    expect(await appOnly.session()).toEqual({ kind: 'unavailable' })
    expect(await device().deps.api.session()).toEqual({ kind: 'signedIn', email: ASH })
  })

  it('remembers what was done when the connection breaks half-way', async () => {
    const pc = device()
    pc.create('Arkani')
    pc.create('Bisasam')
    let calls = 0
    const flaky: Send = (path, init) => {
      if (init?.method === 'PUT' && ++calls === 2) return Promise.reject(new TypeError('Failed to fetch'))
      return handleApi(new Request(`https://pokebinder.example${path}`, init), ASH, server)
    }
    pc.deps.api = createSyncApi(flaky)

    await expect(pc.sync()).rejects.toBeInstanceOf(TypeError)

    expect(Object.keys(pc.state.base)).toHaveLength(1)
    expect((await server.listBinders(ASH)).map((entry) => entry.id)).toEqual(Object.keys(pc.state.base))
    // the next sync sends the rest
    await pc.sync()
    expect(await server.listBinders(ASH)).toHaveLength(2)
  })
})
