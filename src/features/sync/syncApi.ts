import type { Asset, Binder } from '../../types/binder'
import type { Deck } from '../../types/deck'
import type { RemoteEntry } from './syncPlan'

/** How a request reaches the server; replaced in tests. */
export type Send = (path: string, init?: RequestInit) => Promise<Response>

/** Whether the collector is signed in on this device, as far as that can be told. */
export type Session =
  | { kind: 'signedIn'; email: string }
  | { kind: 'signedOut' }
  /** The server could not be reached. */
  | { kind: 'offline' }
  /** There is no server part where the app runs (e.g. during development). */
  | { kind: 'unavailable' }

/** An image the server keeps, without the picture itself. */
export interface RemoteAsset {
  id: string
  mimeType: string
  width: number
  height: number
  createdAt?: string
}

// What the server takes (see worker/api.ts). Asked here first: an image it would refuse
// is not sent on every sync just to be refused again.
const SYNCED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SYNCED_IMAGE_BYTES = 12_000_000

/** The server wants the collector to sign in (again). */
export class SignedOutError extends Error {}

export interface SyncApi {
  session(): Promise<Session>
  listBinders(): Promise<RemoteEntry[]>
  /** A binder as the server keeps it, unchecked; `undefined` if it has none. */
  getBinder(id: string): Promise<unknown>
  /** `false` if the server has another version than `base` says. */
  putBinder(binder: Binder, base: string | null): Promise<boolean>
  deleteBinder(id: string, deletedAt: string, base: string | null): Promise<boolean>
  /** Decks are synced exactly like binders. */
  listDecks(): Promise<RemoteEntry[]>
  getDeck(id: string): Promise<unknown>
  putDeck(deck: Deck, base: string | null): Promise<boolean>
  deleteDeck(id: string, deletedAt: string, base: string | null): Promise<boolean>
  getWatchlists(): Promise<{ updatedAt: string | null; lists: unknown }>
  putWatchlists(updatedAt: string, lists: unknown, base: string | null): Promise<boolean>
  /** The links this collector made, by binder. */
  listShares(): Promise<{ token: string; binderId: string; copyable: boolean }[]>
  /** Says whether the binder of a link is offered to be copied by whoever opens it. */
  setShareCopyable(token: string, copyable: boolean): Promise<void>
  /** Makes (or gets) the link for a binder; `undefined` if the server does not have the binder. */
  createShare(binderId: string): Promise<string | undefined>
  deleteShare(token: string): Promise<void>
  listAssets(): Promise<RemoteAsset[]>
  /** The picture of an image on record; `undefined` if the server has none. */
  getAsset(record: RemoteAsset): Promise<Asset | undefined>
  /** `false` if the server does not take the image (too large, or of a kind it does not keep). */
  putAsset(asset: Asset): Promise<boolean>
}

// Whoever is not signed in is sent on to the sign-in page of Cloudflare Access. A request
// made by the app must not follow there: it would only fail in a way that looks like no
// connection. Held back, the redirect shows as what it is.
const sendFromBrowser: Send = (path, init) => fetch(path, { ...init, redirect: 'manual', credentials: 'same-origin' })

const isJson = (response: Response) => (response.headers.get('content-type') ?? '').includes('application/json')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function wantsSignIn(response: Response): boolean {
  return response.type === 'opaqueredirect' || [301, 302, 303, 307, 401, 403].includes(response.status)
}

export function createSyncApi(send: Send = sendFromBrowser): SyncApi {
  /** An answer of the API itself: sign-in pages and failures are thrown. */
  async function call(path: string, init?: RequestInit): Promise<Response> {
    const response = await send(path, init)
    if (wantsSignIn(response)) throw new SignedOutError()
    return response
  }

  async function read(path: string): Promise<Record<string, unknown>> {
    const response = await call(path)
    const body: unknown = response.ok && isJson(response) ? await response.json() : undefined
    if (!isRecord(body)) throw new Error(`sync: ${path} answered ${response.status}`)
    return body
  }

  /** Sends a change; `false` if the server turned it away as out of date. */
  async function write(path: string, method: 'PUT' | 'DELETE', body: unknown): Promise<boolean> {
    const response = await call(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.status === 409) return false
    if (!response.ok) throw new Error(`sync: ${method} ${path} answered ${response.status}`)
    return true
  }

  /** What the server has of binders or decks: which, when changed, whether deleted. */
  async function list(resource: 'binders' | 'decks'): Promise<RemoteEntry[]> {
    const body = await read(`/api/${resource}`)
    const entries = body[resource]
    if (!Array.isArray(entries)) throw new Error(`sync: no list of ${resource}`)
    return (entries as unknown[]).flatMap((entry): RemoteEntry[] =>
      isRecord(entry) && typeof entry.id === 'string' && typeof entry.updatedAt === 'string'
        ? [{ id: entry.id, updatedAt: entry.updatedAt, deleted: entry.deleted === true }]
        : [],
    )
  }

  async function get(resource: 'binders' | 'decks', one: 'binder' | 'deck', id: string): Promise<unknown> {
    const response = await call(`/api/${resource}/${encodeURIComponent(id)}`)
    if (response.status === 404) return undefined
    const body: unknown = response.ok && isJson(response) ? await response.json() : undefined
    if (!isRecord(body)) throw new Error(`sync: ${one} answered ${response.status}`)
    return body[one]
  }

  return {
    async session() {
      let response: Response
      try {
        response = await send('/api/me')
      } catch {
        return { kind: 'offline' }
      }
      if (wantsSignIn(response)) return { kind: 'signedOut' }
      // where there is no server part, the app's own page answers every address
      if (!response.ok || !isJson(response)) return { kind: 'unavailable' }
      const body: unknown = await response.json().catch(() => undefined)
      return isRecord(body) && typeof body.email === 'string' && body.email !== ''
        ? { kind: 'signedIn', email: body.email }
        : { kind: 'unavailable' }
    },

    listBinders: () => list('binders'),
    getBinder: (id) => get('binders', 'binder', id),
    listDecks: () => list('decks'),
    getDeck: (id) => get('decks', 'deck', id),
    putDeck: (deck, base) => write(`/api/decks/${encodeURIComponent(deck.id)}`, 'PUT', { deck, base }),
    deleteDeck: (id, deletedAt, base) => write(`/api/decks/${encodeURIComponent(id)}`, 'DELETE', { deletedAt, base }),

    putBinder: (binder, base) => write(`/api/binders/${encodeURIComponent(binder.id)}`, 'PUT', { binder, base }),

    deleteBinder: (id, deletedAt, base) =>
      write(`/api/binders/${encodeURIComponent(id)}`, 'DELETE', { deletedAt, base }),

    async getWatchlists() {
      const { updatedAt, lists } = await read('/api/watchlists')
      return { updatedAt: typeof updatedAt === 'string' ? updatedAt : null, lists }
    },

    putWatchlists: (updatedAt, lists, base) => write('/api/watchlists', 'PUT', { updatedAt, lists, base }),

    async listShares() {
      const { shares } = await read('/api/shares')
      if (!Array.isArray(shares)) throw new Error('sync: no list of links')
      return (shares as unknown[]).flatMap((entry) =>
        isRecord(entry) && typeof entry.token === 'string' && typeof entry.binderId === 'string'
          ? // a server from before the choice existed says nothing, and allowed it
            [{ token: entry.token, binderId: entry.binderId, copyable: entry.copyable !== false }]
          : [],
      )
    },

    async setShareCopyable(token, copyable) {
      const response = await call(`/api/shares/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ copyable }),
      })
      if (!response.ok) throw new Error(`sync: link answered ${response.status}`)
    },

    async createShare(binderId) {
      const response = await call('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ binderId }),
      })
      if (response.status === 404) return undefined
      const body: unknown = response.ok && isJson(response) ? await response.json() : undefined
      const share = isRecord(body) ? body.share : undefined
      if (!isRecord(share) || typeof share.token !== 'string') throw new Error(`sync: link answered ${response.status}`)
      return share.token
    },

    async deleteShare(token) {
      const response = await call(`/api/shares/${encodeURIComponent(token)}`, { method: 'DELETE' })
      // a link that is gone already is as good as withdrawn
      if (!response.ok && response.status !== 404) throw new Error(`sync: link answered ${response.status}`)
    },

    async listAssets() {
      const { assets } = await read('/api/assets')
      if (!Array.isArray(assets)) throw new Error('sync: no list of images')
      return (assets as unknown[]).flatMap((entry): RemoteAsset[] => {
        if (!isRecord(entry)) return []
        const { id, mimeType, width, height, createdAt } = entry
        if (typeof id !== 'string' || typeof mimeType !== 'string') return []
        if (typeof width !== 'number' || typeof height !== 'number') return []
        return [{ id, mimeType, width, height, ...(typeof createdAt === 'string' ? { createdAt } : {}) }]
      })
    },

    async getAsset(record) {
      const response = await call(`/api/assets/${encodeURIComponent(record.id)}`)
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`sync: image answered ${response.status}`)
      const bytes = await response.arrayBuffer()
      return { ...record, blob: new Blob([bytes], { type: record.mimeType }) }
    },

    async putAsset(asset) {
      if (!SYNCED_IMAGE_TYPES.includes(asset.mimeType) || asset.blob.size > MAX_SYNCED_IMAGE_BYTES) return false
      if (asset.width < 1 || asset.height < 1) return false
      const query = new URLSearchParams({ width: String(asset.width), height: String(asset.height) })
      if (asset.createdAt) query.set('createdAt', asset.createdAt)
      const response = await call(`/api/assets/${encodeURIComponent(asset.id)}?${query.toString()}`, {
        method: 'PUT',
        headers: { 'content-type': asset.mimeType },
        // as bytes: sent the same way by every browser, and readable in tests
        body: await asset.blob.arrayBuffer(),
      })
      // a refusal of this one image must not keep the others from being sent
      if (response.status >= 400 && response.status < 500) return false
      if (!response.ok) throw new Error(`sync: image answered ${response.status}`)
      return true
    },
  }
}
