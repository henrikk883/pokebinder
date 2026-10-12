import type { Asset, Binder } from '../../types/binder'
import { referencedAssetIds } from '../export/backup'
import { mergeWatchlists, parseWatchlists, savedCardCount, type Watchlist } from '../search/watchlist'
import type { SyncApi } from './syncApi'
import { planSync } from './syncPlan'
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
  /** The collector's own images, which binders refer to by id. */
  assets: {
    ids(): Promise<string[]>
    load(ids: string[]): Promise<Asset[]>
    save(assets: Asset[]): Promise<void>
  }
  /** Checks a binder that came from the server; throws if it cannot be used. */
  readBinder: (value: unknown) => Binder
  lists: {
    get(): Watchlist[]
    /** Puts other lists in place without that counting as a change made here. */
    replace(lists: Watchlist[]): void
  }
  state: SyncStateStorage
  now: () => string
}

/** A binder changed on this device and on another one since they last agreed. */
export interface SyncConflict {
  id: string
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
 * Images travel with the binders that use them: what a binder of this device shows is
 * sent if the server lacks it, and fetched if this device does. Images never change and
 * are never deleted by a sync; one that no binder uses stays where it is.
 */
async function syncImages({ api, binders, assets }: SyncDeps): Promise<number> {
  const needed = new Set((await binders.list()).flatMap(referencedAssetIds))
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

/**
 * Brings the binders and lists of this device in line with the server's, for the
 * collector who is signed in. What can be settled without asking is settled; binders
 * changed on both sides are reported and left alone until `decisions` says which to keep.
 * Throws if the server cannot be reached; what was done until then stays done.
 */
export async function runSync(deps: SyncDeps, email: string, decisions: SyncDecisions = {}): Promise<SyncResult> {
  const { api, binders, state: storage } = deps
  let state = storage.read()
  if (state.user !== email) {
    state = { ...EMPTY_SYNC_STATE, user: email }
    storage.write(state)
  }

  const local = await binders.list()
  const remote = await api.listBinders()
  const localById = new Map(local.map((binder) => [binder.id, binder]))
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]))
  const base = new Map(Object.entries(state.base))
  /** Deletions made here that need no more remembering. */
  const settled = new Set<string>()
  const result: SyncResult = { conflicts: [], changed: [], imagesFetched: 0 }

  // what is the same on both sides is agreed on from now
  for (const binder of local) {
    const there = remoteById.get(binder.id)
    if (there && !there.deleted && there.updatedAt === binder.updatedAt) base.set(binder.id, binder.updatedAt)
  }

  /** Whether the binder is still as it was when the plan was made. */
  const untouched = async (id: string) => (await binders.load(id))?.updatedAt === localById.get(id)?.updatedAt

  async function push(id: string): Promise<void> {
    const binder = localById.get(id)
    if (!binder) return
    // turned away means another device was quicker: the next sync sees that
    if (await api.putBinder(binder, remoteById.get(id)?.updatedAt ?? null)) base.set(id, binder.updatedAt)
  }

  async function pull(id: string): Promise<void> {
    const raw = await api.getBinder(id)
    if (raw === undefined) return
    let binder: Binder
    try {
      binder = deps.readBinder(raw)
    } catch {
      // not something this version of the app can show: better left where it is
      return
    }
    if (binder.id !== id || !(await untouched(id))) return
    await binders.save(binder)
    base.set(id, binder.updatedAt)
    result.changed.push(id)
  }

  try {
    for (const action of planSync({ local, remote, base: state.base, deletedLocally: state.deleted })) {
      const { id } = action
      if (action.kind === 'push') {
        await push(id)
      } else if (action.kind === 'pull') {
        await pull(id)
      } else if (action.kind === 'deleteRemote') {
        if (await api.deleteBinder(id, deps.now(), remoteById.get(id)?.updatedAt ?? null)) {
          base.delete(id)
          settled.add(id)
        }
      } else if (action.kind === 'deleteLocal') {
        if (await untouched(id)) {
          await binders.remove(id)
          base.delete(id)
          result.changed.push(id)
        }
      } else if (action.kind === 'forget') {
        base.delete(id)
        settled.add(id)
      } else if (decisions[id] === 'local') {
        await push(id)
      } else if (decisions[id] === 'remote') {
        await pull(id)
      } else {
        result.conflicts.push({
          id,
          name: localById.get(id)?.name ?? '',
          localUpdatedAt: action.localUpdatedAt,
          remoteUpdatedAt: action.remoteUpdatedAt,
        })
      }
    }
  } finally {
    // binders deleted here in the meantime are remembered in storage, not in `state`
    const latest = storage.read()
    storage.write({ ...latest, user: email, base: Object.fromEntries(base), deleted: latest.deleted.filter((id) => !settled.has(id)) })
  }

  await syncLists(deps)
  result.imagesFetched = await syncImages(deps)
  return result
}
