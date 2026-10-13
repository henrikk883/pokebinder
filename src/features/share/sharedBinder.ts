import type { Asset, Binder } from '../../types/binder'
import { readBinder, referencedAssetIds } from '../export/backup'

/** The part of an address that names a shared binder: `…/?share=<token>`. */
export const SHARE_PARAM = 'share'

/** The link of a share, as it is handed to others. */
export function shareUrl(token: string, origin: string): string {
  return `${origin}/?${SHARE_PARAM}=${encodeURIComponent(token)}`
}

/** The token in the address the app was opened with, if it is a share link. */
export function shareTokenOf(search: string): string | undefined {
  const token = new URLSearchParams(search).get(SHARE_PARAM)
  return token && /^[A-Za-z0-9_-]{20,64}$/.test(token) ? token : undefined
}

/** The link does not exist (any more), or what it leads to cannot be shown. */
export class SharedNotFoundError extends Error {}

type Fetch = (path: string) => Promise<Response>

export interface SharedBinder {
  binder: Binder
  /** The pictures the binder shows, as far as they could be fetched. */
  assets: Asset[]
  /** Whether its collector offers the binder to be copied into a collection of one's own. */
  copyable: boolean
}

/**
 * Fetches the binder a link is for, with its pictures. Throws `SharedNotFoundError` when
 * the link is not valid; other errors mean the server could not be reached.
 */
export async function loadSharedBinder(token: string, send: Fetch = (path) => fetch(path)): Promise<SharedBinder> {
  const base = `/shared/${encodeURIComponent(token)}`
  const response = await send(base)
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json')
  // where there is no server part, the app's own page answers every address
  if (!response.ok || !isJson) throw new SharedNotFoundError()
  let binder: Binder
  let copyable: boolean
  try {
    const body = (await response.json()) as { binder?: unknown; copyable?: unknown }
    binder = readBinder(body.binder)
    // only a plain "no" forbids it; a server from before the choice existed says nothing
    copyable = body.copyable !== false
  } catch {
    throw new SharedNotFoundError()
  }

  const assets: Asset[] = []
  for (const id of referencedAssetIds(binder)) {
    // a picture that cannot be had leaves its pockets empty; the cards are there all the same
    const picture = await send(`${base}/assets/${encodeURIComponent(id)}`).catch(() => undefined)
    if (!picture?.ok) continue
    const mimeType = (picture.headers.get('content-type') ?? '').split(';')[0] ?? ''
    if (!mimeType.startsWith('image/')) continue
    assets.push({
      id,
      blob: new Blob([await picture.arrayBuffer()], { type: mimeType }),
      mimeType,
      width: Number(picture.headers.get('x-image-width')) || 0,
      height: Number(picture.headers.get('x-image-height')) || 0,
    })
  }
  return { binder, assets, copyable }
}
