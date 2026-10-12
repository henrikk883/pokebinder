import { create } from 'zustand'
import { binderRepository } from '../../db/binderRepository'
import { assetStore } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { Binder } from '../../types/binder'
import { readBinder } from '../export/backup'
import { createSyncApi, SignedOutError, type Session } from './syncApi'
import { runSync, type SyncConflict, type SyncDecisions, type SyncDeps } from './syncRun'
import { browserSyncState, withDeleted, withListsChanged } from './syncState'

export type SyncStatus =
  /** Not asked yet. */
  | 'unknown'
  /** Nothing to sync with where the app runs; the app is as it was without sync. */
  | 'unavailable'
  | 'signedOut'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'failed'

interface SyncStoreState {
  status: SyncStatus
  /** Who is signed in; kept while there is no connection. */
  email: string | null
  /** Binders changed here and elsewhere, waiting for the collector's word. */
  conflicts: SyncConflict[]
}

export const useSyncStore = create<SyncStoreState>()(() => ({ status: 'unknown', email: null, conflicts: [] }))

/** A change is sent this long after it was saved, so that a row of them goes as one. */
const AFTER_CHANGE_MS = 2500
/** Coming back to the app looks for news, but not more often than this. */
const LOOK_AGAIN_MS = 20_000

const api = createSyncApi()
// lists put in place by a sync are no change made on this device
let applyingLists = false

const deps: SyncDeps = {
  api,
  binders: {
    list: () => binderRepository.listBinders(),
    load: (id) => binderRepository.loadBinder(id),
    save: (binder) => binderRepository.saveBinder(binder),
    remove: (id) => binderRepository.deleteBinder(id),
  },
  assets: {
    ids: () => binderRepository.listAssetIds(),
    load: (ids) => binderRepository.loadAssets(ids),
    save: (assets) => binderRepository.saveAssets(assets),
  },
  readBinder,
  lists: {
    get: () => useWatchlistStore.getState().lists,
    replace: (lists) => {
      applyingLists = true
      try {
        useWatchlistStore.getState().replace(lists)
      } finally {
        applyingLists = false
      }
    },
  },
  state: browserSyncState,
  now: () => new Date().toISOString(),
}

/** Shows what a sync changed: on the shelf, and in the binder that lies open. */
async function showChanges(changed: readonly string[], openBefore: Binder | null): Promise<void> {
  // only if nothing was done to the open binder while the sync ran
  if (openBefore && binderStore.getState().binder === openBefore && changed.includes(openBefore.id)) {
    const stored = await binderRepository.loadBinder(openBefore.id)
    if (stored) binderStore.getState().openBinder(stored)
    else binderStore.getState().closeBinder()
  }
  useEditorStore.getState().refreshBinderList()
}

async function syncOnce(decisions: SyncDecisions): Promise<void> {
  const { email } = useSyncStore.getState()
  if (!email) return
  useSyncStore.setState({ status: 'syncing' })
  // a change made a moment ago must be part of it
  await binderStore.getState().whenSaved()
  const openBefore = binderStore.getState().binder
  try {
    const result = await runSync(deps, email, decisions)
    if (result.changed.length > 0) await showChanges(result.changed, openBefore)
    if (result.imagesFetched > 0) await assetStore.getState().load()
    useSyncStore.setState({ status: 'synced', conflicts: result.conflicts })
  } catch (error) {
    if (error instanceof SignedOutError) {
      useSyncStore.setState({ status: 'signedOut', email: null, conflicts: [] })
    } else {
      // a request that did not get through fails as a TypeError
      useSyncStore.setState({ status: error instanceof TypeError ? 'offline' : 'failed' })
    }
  }
}

let running: Promise<void> | null = null
let again = false
let queued: SyncDecisions = {}
let timer: ReturnType<typeof setTimeout> | undefined
let lastRun = 0

/** One sync at a time; whatever is asked for meanwhile is done right after. */
function run(decisions: SyncDecisions = {}): Promise<void> {
  queued = { ...queued, ...decisions }
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const current = queued
      queued = {}
      lastRun = Date.now()
      await syncOnce(current)
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

/** Syncs soon, if a collector is signed in; several calls in a row lead to one sync. */
export function requestSync(delayMs = 0): void {
  if (!useSyncStore.getState().email) return
  clearTimeout(timer)
  timer = setTimeout(() => void run(), delayMs)
}

/** Carries out what the collector decided about binders changed on two devices. */
export function resolveConflicts(decisions: SyncDecisions): Promise<void> {
  return run(decisions)
}

/** To be called when a binder was deleted on this device, so that other devices learn of it. */
export function noteBinderDeleted(binderId: string): void {
  browserSyncState.write(withDeleted(browserSyncState.read(), binderId))
  requestSync()
}

function applySession(session: Session): void {
  if (session.kind === 'signedIn') {
    useSyncStore.setState({ email: session.email })
    void run()
  } else if (session.kind === 'signedOut') {
    useSyncStore.setState({ status: 'signedOut', email: null, conflicts: [] })
  } else if (session.kind === 'offline') {
    // whoever synced on this device before is told why nothing happens now
    const { user } = browserSyncState.read()
    useSyncStore.setState(user ? { status: 'offline', email: user } : { status: 'unavailable' })
  } else {
    useSyncStore.setState({ status: 'unavailable', email: null, conflicts: [] })
  }
}

/**
 * Finds out whether a collector is signed in and from then on keeps this device in sync:
 * at start, after every change, and when the app is come back to. Returns how to stop.
 */
export function startSync(): () => void {
  let stopped = false
  const look = () =>
    void api.session().then((session) => {
      if (!stopped) applySession(session)
    })
  look()

  const stopBinders = binderStore.subscribe((state, before) => {
    if (state.saveStatus === 'saved' && before.saveStatus === 'saving') requestSync(AFTER_CHANGE_MS)
  })
  const stopLists = useWatchlistStore.subscribe((state, before) => {
    if (state.lists === before.lists || applyingLists) return
    browserSyncState.write(withListsChanged(browserSyncState.read(), new Date().toISOString()))
    requestSync(AFTER_CHANGE_MS)
  })
  const lookAgain = () => {
    const { status } = useSyncStore.getState()
    if (document.visibilityState !== 'visible' || status === 'unavailable' || status === 'unknown') return
    if (Date.now() - lastRun >= LOOK_AGAIN_MS || status === 'offline') look()
  }
  window.addEventListener('online', lookAgain)
  document.addEventListener('visibilitychange', lookAgain)

  return () => {
    stopped = true
    clearTimeout(timer)
    stopBinders()
    stopLists()
    window.removeEventListener('online', lookAgain)
    document.removeEventListener('visibilitychange', lookAgain)
  }
}

/** Sends the browser to sign in; it comes back to where it was. */
export function signIn(): void {
  const { pathname, search } = window.location
  window.location.assign(`/api/login?return=${encodeURIComponent(pathname + search)}`)
}

/** Ends the session at Cloudflare Access. What is on this device stays. */
export function signOut(): void {
  window.location.assign('/cdn-cgi/access/logout')
}
