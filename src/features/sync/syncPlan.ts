/**
 * Bringing the binders of this device in line with those kept for the collector on the
 * server. This is the reasoning only: given what both sides have and what they agreed on
 * last time, it says what to send, what to fetch, and where the collector has to decide.
 */

/** A binder as this device has it. */
export interface LocalEntry {
  id: string
  /** ISO 8601 time of the last change. */
  updatedAt: string
}

/** A binder as the server has it; one that was deleted stays on record as such. */
export interface RemoteEntry {
  id: string
  updatedAt: string
  deleted: boolean
}

/**
 * What both sides had when they last agreed on a binder: its `updatedAt` then. A binder
 * that never took part in a sync is not in here.
 */
export type SyncBase = Readonly<Record<string, string>>

export type SyncAction =
  /** This device has the later version, or the only one: send it. */
  | { kind: 'push'; id: string }
  /** The server has the later version, or the only one: fetch it. */
  | { kind: 'pull'; id: string }
  /** Deleted on this device since the last sync: delete it on the server too. */
  | { kind: 'deleteRemote'; id: string }
  /** Deleted on another device since the last sync: delete it here too. */
  | { kind: 'deleteLocal'; id: string }
  /** Changed on both sides since the last sync: the collector picks one. */
  | { kind: 'conflict'; id: string; localUpdatedAt: string; remoteUpdatedAt: string }
  /** Gone on both sides: nothing to do but to forget it. */
  | { kind: 'forget'; id: string }

export interface SyncInput {
  local: readonly LocalEntry[]
  remote: readonly RemoteEntry[]
  base: SyncBase
  /** Ids of binders deleted on this device that the server has not been told about yet. */
  deletedLocally: readonly string[]
}

/**
 * What has to happen so that both sides have the same binders, one action per binder that
 * differs, ordered by id. Binders that are the same on both sides need none.
 *
 * A change always wins over a deletion made on the other side: if a binder was deleted on
 * one device and worked on on another, it comes back rather than being lost.
 */
export function planSync({ local, remote, base, deletedLocally }: SyncInput): SyncAction[] {
  const localById = new Map(local.map((entry) => [entry.id, entry]))
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]))
  const deleted = new Set(deletedLocally)
  // also what is only remembered from last time: it is gone on both sides and to be forgotten
  const ids = [...new Set([...localById.keys(), ...remoteById.keys(), ...deleted, ...Object.keys(base)])].sort()
  const actions: SyncAction[] = []

  for (const id of ids) {
    const here = localById.get(id)
    const there = remoteById.get(id)
    const agreed = base[id]

    if (here && there && !there.deleted) {
      if (here.updatedAt === there.updatedAt) continue
      const changedHere = here.updatedAt !== agreed
      const changedThere = there.updatedAt !== agreed
      if (changedHere && changedThere) {
        actions.push({ kind: 'conflict', id, localUpdatedAt: here.updatedAt, remoteUpdatedAt: there.updatedAt })
      } else {
        actions.push({ kind: changedHere ? 'push' : 'pull', id })
      }
    } else if (here) {
      // not on the server, or deleted there: it stays deleted only if nothing changed here since
      const untouched = agreed !== undefined && here.updatedAt === agreed
      actions.push({ kind: there?.deleted && untouched ? 'deleteLocal' : 'push', id })
    } else if (there && !there.deleted) {
      // not on this device: deleted here, unless the server version is newer than what was deleted
      const deletedAsAgreed = deleted.has(id) && (agreed === undefined || there.updatedAt === agreed)
      actions.push({ kind: deletedAsAgreed ? 'deleteRemote' : 'pull', id })
    } else if (deleted.has(id) || agreed !== undefined) {
      actions.push({ kind: 'forget', id })
    }
  }
  return actions
}

/**
 * The base after the actions were carried out: every binder both sides now have, with the
 * time they agree on. `resolved` holds the outcome of each conflict the collector decided
 * (`updatedAt` of the version that was kept); undecided conflicts keep their old base, so
 * that they come up again.
 */
export function nextBase(
  { local, remote, base }: Pick<SyncInput, 'local' | 'remote' | 'base'>,
  actions: readonly SyncAction[],
  resolved: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const localById = new Map(local.map((entry) => [entry.id, entry]))
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]))
  const byId = new Map(actions.map((action) => [action.id, action]))
  const next: Record<string, string> = {}

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const action = byId.get(id)
    const here = localById.get(id)?.updatedAt
    const there = remoteById.get(id)?.updatedAt
    if (!action) {
      // the same on both sides
      if (here !== undefined) next[id] = here
    } else if (action.kind === 'push' && here !== undefined) {
      next[id] = here
    } else if (action.kind === 'pull' && there !== undefined) {
      next[id] = there
    } else if (action.kind === 'conflict') {
      const kept = resolved[id] ?? base[id]
      if (kept !== undefined) next[id] = kept
    }
    // deleted on either side, or forgotten: no longer something both sides have
  }
  return next
}
