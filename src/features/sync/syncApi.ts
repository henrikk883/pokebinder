import type { Binder } from '../../types/binder'
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
  getWatchlists(): Promise<{ updatedAt: string | null; lists: unknown }>
  putWatchlists(updatedAt: string, lists: unknown, base: string | null): Promise<boolean>
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

    async listBinders() {
      const { binders } = await read('/api/binders')
      if (!Array.isArray(binders)) throw new Error('sync: no list of binders')
      return (binders as unknown[]).flatMap((entry): RemoteEntry[] =>
        isRecord(entry) && typeof entry.id === 'string' && typeof entry.updatedAt === 'string'
          ? [{ id: entry.id, updatedAt: entry.updatedAt, deleted: entry.deleted === true }]
          : [],
      )
    },

    async getBinder(id) {
      const response = await call(`/api/binders/${encodeURIComponent(id)}`)
      if (response.status === 404) return undefined
      const body: unknown = response.ok && isJson(response) ? await response.json() : undefined
      if (!isRecord(body)) throw new Error(`sync: binder answered ${response.status}`)
      return body.binder
    },

    putBinder: (binder, base) => write(`/api/binders/${encodeURIComponent(binder.id)}`, 'PUT', { binder, base }),

    deleteBinder: (id, deletedAt, base) =>
      write(`/api/binders/${encodeURIComponent(id)}`, 'DELETE', { deletedAt, base }),

    async getWatchlists() {
      const { updatedAt, lists } = await read('/api/watchlists')
      return { updatedAt: typeof updatedAt === 'string' ? updatedAt : null, lists }
    },

    putWatchlists: (updatedAt, lists, base) => write('/api/watchlists', 'PUT', { updatedAt, lists, base }),
  }
}
