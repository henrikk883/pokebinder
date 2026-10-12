import type { SyncBase } from './syncPlan'

/**
 * What this device remembers between two syncs: what it and the server last agreed on,
 * and what happened here since that the stored binders and lists do not show by themselves.
 */
export interface SyncState {
  /** Whose binders the rest is about; another collector signing in starts afresh. */
  user: string | null
  /** For every binder both sides had after the last sync: its `updatedAt` then. */
  base: SyncBase
  /** Binders deleted on this device that the server has not been told about yet. */
  deleted: readonly string[]
  /** `updatedAt` of the lists on the server when this device last had the same ones. */
  listsBase: string | null
  /** When the lists were last changed on this device since then; `null` if they were not. */
  listsChangedAt: string | null
}

export const EMPTY_SYNC_STATE: SyncState = { user: null, base: {}, deleted: [], listsBase: null, listsChangedAt: null }

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

/** Reads what was stored; anything that cannot be read counts as never synced. */
export function parseSyncState(text: string | null): SyncState {
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : undefined
  } catch {
    raw = undefined
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY_SYNC_STATE
  const { user, base, deleted, listsBase, listsChangedAt } = raw as Record<string, unknown>
  return {
    user: stringOrNull(user),
    base:
      typeof base === 'object' && base !== null && !Array.isArray(base)
        ? Object.fromEntries(
            Object.entries(base).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          )
        : {},
    deleted: Array.isArray(deleted) ? (deleted as unknown[]).filter((id) => typeof id === 'string') : [],
    listsBase: stringOrNull(listsBase),
    listsChangedAt: stringOrNull(listsChangedAt),
  }
}

/** A binder was deleted here: worth remembering only if the server may have it. */
export function withDeleted(state: SyncState, binderId: string): SyncState {
  if (state.base[binderId] === undefined || state.deleted.includes(binderId)) return state
  return { ...state, deleted: [...state.deleted, binderId] }
}

export function withListsChanged(state: SyncState, now: string): SyncState {
  return { ...state, listsChangedAt: now }
}

/** Where the state is kept; replaced in tests. */
export interface SyncStateStorage {
  read(): SyncState
  write(state: SyncState): void
}

const SYNC_KEY = 'pokebinder:sync'

export const browserSyncState: SyncStateStorage = {
  read() {
    try {
      return parseSyncState(localStorage.getItem(SYNC_KEY))
    } catch {
      return EMPTY_SYNC_STATE
    }
  },
  write(state) {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify(state))
    } catch {
      // without storage every sync compares from scratch; nothing gets lost by that
    }
  },
}
