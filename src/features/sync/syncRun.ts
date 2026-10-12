import type { Asset, Binder } from '../../types/binder'
import type { Deck } from '../../types/deck'
import { referencedAssetIds } from '../export/backup'
import { mergeWatchlists, parseWatchlists, savedCardCount, type Watchlist } from '../search/watchlist'
import type { SyncApi } from './syncApi'
import { planSync, type RemoteEntry, type SyncBase } from './syncPlan'
import { EMPTY_SYNC_STATE, type SyncStateStorage } from './syncState'

/** What a sync works with; the app hands in its database and stores, tests their own. */
export interface SyncDeps {
  api: SyncApi
  binders: {
    list(): Promise<Binder[]>
    load(id: string): Promise<Binder | undefined>
    save(binder: Binder): Promise<void>
    remove(id: string): Promise<void>
  }
  decks: {
    list(): Promise<Deck[]>
    load(id: string): Promise<Deck | undefined>
    save(deck: Deck): Promise<void>
    remove(id: string): Promise<void>
  }
  /** The collector's own images, which binders and deck boxes refer to by id. */
  assets: {
    ids(): Promise<string[]>
    load(ids: string[]): Promise<Asset[]>
    save(assets: Asset[]): Promise<void>
  }
  /** Checks a binder that came from the server; throws if it cannot be used. */
  readBinder: (value: unknown) => Binder
  readDeck: (value: unknown) => Deck
  lists: {
    get(): Watchlist[]
    /** Puts other lists in place without that counting as a change made here. */
    replace(lists: Watchlist[]): void
  }
  state: SyncStateStorage
  now: () => string
}

/** A binder or a deck changed on this device and on another one since they last agreed. */
export interface SyncConflict {
  id: string
  kind: 'binder' | 'deck'
  name: string
  localUpdatedAt: string
  remoteUpdatedAt: string
}

/** Which version of a binder in conflict is to stay: the one here, or the server's. */
export type SyncDecisions = Readonly<Record<string, 'local' | 'remote'>>

export interface SyncResult {
  /** Still to be decided by the collector. */
  conflicts: SyncConflict[]
  /** Binders of this device that were replaced, added or removed. */
  changed: string[]
  /** The same for decks. */
  changedDecks: string[]
  /** How many images this device was missing and now has. */
  imagesFetched: number
}

/** Lists that hold nothing are not worth sending anywhere. */
function isEmpty(lists: readonly Watchlist[]): boolean {
  return lists.length <= 1 && savedCardCount(lists) === 0
}

/**
 * The "Merklisten" are synced as a whole. Changed on one side, they replace the other
 * side's; changed on both, they are brought together (see `mergeWatchlists`), so nothing
 * that was noted gets lost.
 */
async function syncLists({ api, lists, state: storage, now }: SyncDeps): Promise<void> {
  const before = storage.read()
  const remote = await api.getWatchlists()
  const local = lists.get()
  const changedHere = before.listsChangedAt !== null || (before.listsBase === null && !isEmpty(local))
  const changedThere = remote.updatedAt !== null && remote.updatedAt !== before.listsBase

  let listsBase = before.listsBase
  let sent: boolean
  if (changedThere) {
    const incoming = parseWatchlists(JSON.stringify(remote.lists))
    const next = changedHere ? mergeWatchlists(local, incoming) : incoming
    lists.replace(next)
    listsBase = remote.updatedAt
    if (JSON.stringify(next) === JSON.stringify(incoming)) {
      sent = true
    } else {
      const stamp = now()
      sent = await api.putWatchlists(stamp, next, remote.updatedAt)
      if (sent) listsBase = stamp
    }
  } else if (changedHere) {
    const stamp = before.listsChangedAt ?? now()
    sent = await api.putWatchlists(stamp, local, remote.updatedAt)
    if (sent) listsBase = stamp
  } else {
    return
  }

  // a change made while this was under way stays to be sent next time
  const after = storage.read()
  const changedSince = after.listsChangedAt !== before.listsChangedAt
  storage.write({
    ...after,
    listsBase,
    listsChangedAt: changedSince ? after.listsChangedAt : sent ? null : (before.listsChangedAt ?? now()),
  })
}

/**
 * Images travel with the binders and deck boxes that use them: what one of this device
 * shows is sent if the server lacks it, and fetched if this device does. Images never
 * change and are never deleted by a sync; one that nothing uses stays where it is.
 */
async function syncImages({ api, binders, decks, assets }: SyncDeps): Promise<number> {
  const needed = new Set([
    ...(await binders.list()).flatMap(referencedAssetIds),
    ...(await decks.list()).flatMap((deck) => deck.coverAssetId ?? []),
  ])
  if (needed.size === 0) return 0
  const here = new Set(await assets.ids())
  const there = new Map((await api.listAssets()).map((record) => [record.id, record]))

  let fetched = 0
  for (const id of needed) {
    const record = there.get(id)
    if (here.has(id)) {
      if (record) continue
      // one at a time: they can be large
      const [asset] = await assets.load([id])
      if (asset) await api.putAsset(asset)
    } else if (record) {
      const asset = await api.getAsset(record)
      if (!asset) continue
      await assets.save([asset])
      fetched++
    }
  }
  return fetched
}

/** What is synced one by one: binders and decks. Each has an id, a name and a time of its last change. */
interface Syncable {
  id: string
  name: string
  updatedAt: string
}

/** One kind of thing to sync, with where it lives on this device and on the server. */
interface Records<T extends Syncable> {
  kind: SyncConflict['kind']
  local: {
    list(): Promise<T[]>
    load(id: string): Promise<T | undefined>
    save(item: T): Promise<void>
    remove(id: string): Promise<void>
  }
  remote: {
    list(): Promise<RemoteEntry[]>
    get(id: string): Promise<unknown>
    put(item: T, base: string | null): Promise<boolean>
    remove(id: string, deletedAt: string, base: string | null): Promise<boolean>
  }
  /** Checks what came from the server; throws if it cannot be used. */
  read: (value: unknown) => T
  base: SyncBase
  deleted: readonly string[]
  /** Called with the state of things whenever the function ends, also when it is cut short. */
  remember: (base: SyncBase, settled: ReadonlySet<string>) => void
}

/**
 * Brings one kind of thing in line with the server. What can be settled without asking is
 * settled; what was changed on both sides is reported and left alone until `decisions`
 * says which version to keep. Returns the ids this device now has differently.
 */
async function syncRecords<T extends Syncable>(
  records: Records<T>,
  decisions: SyncDecisions,
  now: () => string,
  conflicts: SyncConflict[],
): Promise<string[]> {
  const { local: here, remote: there } = records
  const local = await here.list()
  const remote = await there.list()
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]))
  const base = new Map(Object.entries(records.base))
  /** Deletions made here that need no more remembering. */
  const settled = new Set<string>()
  const changed: string[] = []

  // what is the same on both sides is agreed on from now
  for (const item of local) {
    const entry = remoteById.get(item.id)
    if (entry && !entry.deleted && entry.updatedAt === item.updatedAt) base.set(item.id, item.updatedAt)
  }

  /** Whether the thing is still as it was when the plan was made. */
  const untouched = async (id: string) => (await here.load(id))?.updatedAt === localById.get(id)?.updatedAt

  async function push(id: string): Promise<void> {
    const item = localById.get(id)
    if (!item) return
    // turned away means another device was quicker: the next sync sees that
    if (await there.put(item, remoteById.get(id)?.updatedAt ?? null)) base.set(id, item.updatedAt)
  }

  async function pull(id: string): Promise<void> {
    const raw = await there.get(id)
    if (raw === undefined) return
    let item: T
    try {
      item = records.read(raw)
    } catch {
      // not something this version of the app can show: better left where it is
      return
    }
    if (item.id !== id || !(await untouched(id))) return
    await here.save(item)
    base.set(id, item.updatedAt)
    changed.push(id)
  }

  try {
    for (const action of planSync({ local, remote, base: records.base, deletedLocally: records.deleted })) {
      const { id } = action
      if (action.kind === 'push') {
        await push(id)
      } else if (action.kind === 'pull') {
        await pull(id)
      } else if (action.kind === 'deleteRemote') {
        if (await there.remove(id, now(), remoteById.get(id)?.updatedAt ?? null)) {
          base.delete(id)
          settled.add(id)
        }
      } else if (action.kind === 'deleteLocal') {
        if (await untouched(id)) {
          await here.remove(id)
          base.delete(id)
          changed.push(id)
        }
      } else if (action.kind === 'forget') {
        base.delete(id)
        settled.add(id)
      } else if (decisions[id] === 'local') {
        await push(id)
      } else if (decisions[id] === 'remote') {
        await pull(id)
      } else {
        conflicts.push({
          id,
          kind: records.kind,
          name: localById.get(id)?.name ?? '',
          localUpdatedAt: action.localUpdatedAt,
          remoteUpdatedAt: action.remoteUpdatedAt,
        })
      }
    }
  } finally {
    records.remember(Object.fromEntries(base), settled)
  }
  return changed
}

/**
 * Brings the binders, decks and lists of this device in line with the server's, for the
 * collector who is signed in. What can be settled without asking is settled; binders and
 * decks changed on both sides are reported and left alone until `decisions` says which to
 * keep. Throws if the server cannot be reached; what was done until then stays done.
 */
export async function runSync(deps: SyncDeps, email: string, decisions: SyncDecisions = {}): Promise<SyncResult> {
  const { api, state: storage } = deps
  let state = storage.read()
  if (state.user !== email) {
    state = { ...EMPTY_SYNC_STATE, user: email }
    storage.write(state)
  }
  const result: SyncResult = { conflicts: [], changed: [], changedDecks: [], imagesFetched: 0 }

  result.changed = await syncRecords(
    {
      kind: 'binder',
      local: deps.binders,
      remote: { list: api.listBinders, get: api.getBinder, put: api.putBinder, remove: api.deleteBinder },
      read: deps.readBinder,
      base: state.base,
      deleted: state.deleted,
      // what was deleted here in the meantime is remembered in storage, not in `state`
      remember: (base, settled) => {
        const latest = storage.read()
        storage.write({ ...latest, user: email, base, deleted: latest.deleted.filter((id) => !settled.has(id)) })
      },
    },
    decisions,
    deps.now,
    result.conflicts,
  )

  result.changedDecks = await syncRecords(
    {
      kind: 'deck',
      local: deps.decks,
      remote: { list: api.listDecks, get: api.getDeck, put: api.putDeck, remove: api.deleteDeck },
      read: deps.readDeck,
      base: state.deckBase,
      deleted: state.deletedDecks,
      remember: (deckBase, settled) => {
        const latest = storage.read()
        storage.write({
          ...latest,
          user: email,
          deckBase,
          deletedDecks: latest.deletedDecks.filter((id) => !settled.has(id)),
        })
      },
    },
    decisions,
    deps.now,
    result.conflicts,
  )

  await syncLists(deps)
  result.imagesFetched = await syncImages(deps)
  return result
}
