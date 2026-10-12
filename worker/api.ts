import { newShareToken } from './shared'
import type { AssetRecord, SyncStore } from './store'

/**
 * The API the app syncs through, for one collector who has been told from everyone else
 * already (see `access.ts`). It keeps what it is given and hands it back; what a binder
 * looks like is the app's business, which checks everything it fetches.
 *
 *   GET    /api/me                    who is signed in
 *   GET    /api/binders               every binder on record, with time and deletion
 *   GET    /api/binders/:id           one binder
 *   PUT    /api/binders/:id           { binder, base }  store a version
 *   DELETE /api/binders/:id           { deletedAt, base }  record its deletion
 *   …      /api/decks, /api/decks/:id   the same for decks, with { deck, base }
 *   GET    /api/shares                the links this collector made
 *   POST   /api/shares                { binderId }  a link under which anybody may look at that binder
 *   DELETE /api/shares/:token         withdraw a link
 *   GET    /api/watchlists            the lists, or none
 *   PUT    /api/watchlists            { updatedAt, lists, base }
 *   GET    /api/assets                every image on record (without the pictures)
 *   GET    /api/assets/:id            one picture
 *   PUT    /api/assets/:id?width=&height=&createdAt=   the picture as the body
 */

/** A binder of a full master set with every finish is a few hundred kilobytes. */
export const MAX_JSON_BYTES = 1_500_000
/** The app scales uploads down to 2000 px; this leaves room for a large PNG. */
export const MAX_IMAGE_BYTES = 12_000_000
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** Ids are made by the app (UUIDs); anything else has no business in a path or a storage key. */
const ID = /^[A-Za-z0-9_-]{1,80}$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const refuse = (status: number, error: string) => json({ error }, status)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The JSON body of a request, if it is an object and not too large. */
async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) return refuse(413, 'too large')
  try {
    const value: unknown = JSON.parse(text)
    return isRecord(value) ? value : refuse(400, 'not an object')
  } catch {
    return refuse(400, 'not json')
  }
}

const baseOf = (value: unknown): string | null | undefined =>
  value === null || typeof value === 'string' ? value : undefined

export async function handleApi(request: Request, user: string, store: SyncStore): Promise<Response> {
  const url = new URL(request.url)
  const [, api, resource, id, ...rest] = url.pathname.split('/')
  const { method } = request
  if (api !== 'api' || rest.length > 0) return refuse(404, 'not found')

  if (resource === 'me' && id === undefined) {
    return method === 'GET' ? json({ email: user }) : refuse(405, 'method')
  }

  if (resource === 'binders' || resource === 'decks') {
    // decks are kept exactly like binders: same rules, another list, another word
    const records =
      resource === 'binders'
        ? { one: 'binder', list: store.listBinders, get: store.getBinder, put: store.putBinder, remove: store.deleteBinder }
        : { one: 'deck', list: store.listDecks, get: store.getDeck, put: store.putDeck, remove: store.deleteDeck }
    if (id === undefined) {
      return method === 'GET' ? json({ [resource]: await records.list(user) }) : refuse(405, 'method')
    }
    if (!ID.test(id)) return refuse(400, 'id')
    if (method === 'GET') {
      const data = await records.get(user, id)
      // stored as the text it came in; passed on as it is
      return data === undefined
        ? refuse(404, 'not found')
        : new Response(`{"${records.one}":${data}}`, {
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          })
    }
    if (method === 'PUT') {
      const body = await readJson(request)
      if (body instanceof Response) return body
      const base = baseOf(body.base)
      const record = body[records.one]
      if (base === undefined || !isRecord(record)) return refuse(400, 'body')
      if (record.id !== id || typeof record.updatedAt !== 'string' || record.updatedAt === '') {
        return refuse(400, records.one)
      }
      const result = await records.put(user, id, record.updatedAt, JSON.stringify(record), base)
      return result.ok ? json({ updatedAt: record.updatedAt }) : json({ current: result.current }, 409)
    }
    if (method === 'DELETE') {
      const body = await readJson(request)
      if (body instanceof Response) return body
      const base = baseOf(body.base)
      if (base === undefined || typeof body.deletedAt !== 'string' || body.deletedAt === '') {
        return refuse(400, 'body')
      }
      const result = await records.remove(user, id, body.deletedAt, base)
      return result.ok ? json({ updatedAt: body.deletedAt }) : json({ current: result.current }, 409)
    }
    return refuse(405, 'method')
  }

  if (resource === 'shares') {
    if (id === undefined) {
      if (method === 'GET') return json({ shares: await store.listShares(user) })
      if (method !== 'POST') return refuse(405, 'method')
      const body = await readJson(request)
      if (body instanceof Response) return body
      const { binderId } = body
      if (typeof binderId !== 'string' || !ID.test(binderId)) return refuse(400, 'body')
      // only a binder the server has can be shown to others
      if ((await store.getBinder(user, binderId)) === undefined) return refuse(404, 'not found')
      return json({ share: await store.createShare(user, binderId, newShareToken(), new Date().toISOString()) })
    }
    if (!ID.test(id)) return refuse(400, 'id')
    if (method !== 'DELETE') return refuse(405, 'method')
    return (await store.deleteShare(user, id)) ? json({ token: id }) : refuse(404, 'not found')
  }

  if (resource === 'watchlists' && id === undefined) {
    if (method === 'GET') {
      const stored = await store.getWatchlists(user)
      return stored
        ? new Response(`{"updatedAt":${JSON.stringify(stored.updatedAt)},"lists":${stored.data}}`, {
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          })
        : json({ updatedAt: null, lists: [] })
    }
    if (method === 'PUT') {
      const body = await readJson(request)
      if (body instanceof Response) return body
      const base = baseOf(body.base)
      if (base === undefined || typeof body.updatedAt !== 'string' || body.updatedAt === '' || !Array.isArray(body.lists)) {
        return refuse(400, 'body')
      }
      const result = await store.putWatchlists(user, body.updatedAt, JSON.stringify(body.lists), base)
      return result.ok ? json({ updatedAt: body.updatedAt }) : json({ currentUpdatedAt: result.currentUpdatedAt }, 409)
    }
    return refuse(405, 'method')
  }

  if (resource === 'assets') {
    if (id === undefined) {
      return method === 'GET' ? json({ assets: await store.listAssets(user) }) : refuse(405, 'method')
    }
    if (!ID.test(id)) return refuse(400, 'id')
    if (method === 'GET') {
      const asset = await store.getAsset(user, id)
      if (!asset) return refuse(404, 'not found')
      return new Response(asset.bytes, {
        headers: {
          'content-type': asset.record.mimeType,
          // an image never changes under its id, but it is nobody else's business
          'cache-control': 'private, max-age=31536000, immutable',
        },
      })
    }
    if (method === 'PUT') {
      const mimeType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
      if (!IMAGE_TYPES.includes(mimeType)) return refuse(415, 'type')
      const width = Number(url.searchParams.get('width'))
      const height = Number(url.searchParams.get('height'))
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        return refuse(400, 'size')
      }
      const bytes = await request.arrayBuffer()
      if (bytes.byteLength === 0) return refuse(400, 'empty')
      if (bytes.byteLength > MAX_IMAGE_BYTES) return refuse(413, 'too large')
      const record: AssetRecord = { id, mimeType, width, height }
      const createdAt = url.searchParams.get('createdAt')
      if (createdAt) record.createdAt = createdAt
      await store.putAsset(user, record, bytes)
      return json({ id })
    }
    return refuse(405, 'method')
  }

  return refuse(404, 'not found')
}
