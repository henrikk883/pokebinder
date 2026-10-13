import type { SyncStore } from './store'

/**
 * What anybody with a share link may read, without signing in: the one binder the link is
 * for, and the images that binder shows. Nothing else of the collector's, and not who the
 * collector is.
 *
 *   GET /shared/:token                 { binder, copyable }
 *   GET /shared/:token/assets/:id      one picture of that binder
 */

/** Links are made by the server (see `newShareToken`); anything else is no link. */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/
const ASSET_ID = /^[A-Za-z0-9_-]{1,80}$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

/** A link nobody can guess: 18 random bytes, written so that they fit into an address. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The images a stored binder shows: on its cover and behind its pockets. */
export function imagesOfBinder(data: string): Set<string> {
  const ids = new Set<string>()
  let binder: unknown
  try {
    binder = JSON.parse(data)
  } catch {
    return ids
  }
  if (!isRecord(binder)) return ids
  if (isRecord(binder.cover) && typeof binder.cover.assetId === 'string') ids.add(binder.cover.assetId)
  for (const page of Array.isArray(binder.pages) ? (binder.pages as unknown[]) : []) {
    if (!isRecord(page) || !Array.isArray(page.images)) continue
    for (const image of page.images as unknown[]) {
      if (isRecord(image) && typeof image.assetId === 'string') ids.add(image.assetId)
    }
  }
  return ids
}

/**
 * The binder as a link shows it: without the cards laid aside while it is rearranged. They
 * are not on any page, and a visitor is shown the pages.
 */
function withoutTray(data: string): string {
  let binder: unknown
  try {
    binder = JSON.parse(data)
  } catch {
    return data
  }
  if (!isRecord(binder) || binder.tray === undefined) return data
  const shown = { ...binder }
  delete shown.tray
  return JSON.stringify(shown)
}

export async function handleShared(request: Request, store: SyncStore): Promise<Response> {
  const [, shared, token, kind, assetId, ...rest] = new URL(request.url).pathname.split('/')
  if (shared !== 'shared' || rest.length > 0) return json({ error: 'not found' }, 404)
  if (request.method !== 'GET') return json({ error: 'method' }, 405)
  if (token === undefined || !TOKEN.test(token)) return json({ error: 'not found' }, 404)

  const share = await store.findShare(token)
  // a link that was withdrawn, and a binder that was deleted, look like a link that never was
  const data = share ? await store.getBinder(share.user, share.binderId) : undefined
  if (!share || data === undefined) return json({ error: 'not found' }, 404)

  if (kind === undefined) {
    // `copyable` says whether the collector offers the binder to be copied; it is a wish the
    // app follows, not a lock: whoever may look at a binder can write it down
    return new Response(`{"binder":${withoutTray(data)},"copyable":${share.copyable ? 'true' : 'false'}}`, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  if (kind !== 'assets' || assetId === undefined || !ASSET_ID.test(assetId)) return json({ error: 'not found' }, 404)
  // only what the shared binder shows, not the collector's other images
  if (!imagesOfBinder(data).has(assetId)) return json({ error: 'not found' }, 404)
  const asset = await store.getAsset(share.user, assetId)
  if (!asset) return json({ error: 'not found' }, 404)
  return new Response(asset.bytes, {
    headers: {
      'content-type': asset.record.mimeType,
      'x-image-width': String(asset.record.width),
      'x-image-height': String(asset.record.height),
      // an image never changes under its id; the link may stop working, so not for long
      'cache-control': 'private, max-age=3600',
    },
  })
}
