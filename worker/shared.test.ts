// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createBinder, setCard, setOwned } from '../src/features/binder/binderModel'
import { placeImage, setCover } from '../src/features/images/imageModel'
import { loadSharedBinder, SharedNotFoundError, shareTokenOf, shareUrl } from '../src/features/share/sharedBinder'
import { handleApi } from './api'
import { createD1Store } from './d1Store'
import { handleShared, imagesOfBinder, newShareToken } from './shared'
import type { SyncStore } from './store'
import { createTestBucket, createTestDatabase } from './testing'

const monday = '2026-10-12T10:00:00.000Z'
const tuesday = '2026-10-13T10:00:00.000Z'
let store: SyncStore

const api = (user: string, method: string, path: string, body?: unknown) =>
  handleApi(
    new Request(`https://pokebinder.example${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
    user,
    store,
  )
const open = (path: string, method = 'GET') => handleShared(new Request(`https://pokebinder.example${path}`, { method }), store)

/** A binder that shows one picture on its cover and one behind its pockets. */
const binder = (id: string, updatedAt = monday, name = 'Kanto') => ({
  id,
  name,
  updatedAt,
  cover: { title: name, assetId: 'cover' },
  pages: [{ images: [{ assetId: 'forest' }] }],
})

async function share(user: string, binderId: string): Promise<string> {
  const response = await api(user, 'POST', '/api/shares', { binderId })
  expect(response.status).toBe(200)
  return ((await response.json()) as { share: { token: string } }).share.token
}

async function upload(user: string, id: string, bytes: number[]) {
  await store.putAsset(user, { id, mimeType: 'image/png', width: 30, height: 20 }, new Uint8Array(bytes).buffer)
}

beforeEach(async () => {
  store = createD1Store(createTestDatabase(), createTestBucket())
  await api('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto'), base: null })
})

describe('making a link', () => {
  it('gives a binder one link, which stays the same when asked for again', async () => {
    const token = await share('ash', 'kanto')

    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(await share('ash', 'kanto')).toBe(token)
    expect(await (await api('ash', 'GET', '/api/shares')).json()).toMatchObject({ shares: [{ token, binderId: 'kanto' }] })
    expect(await (await api('misty', 'GET', '/api/shares')).json()).toEqual({ shares: [] })
  })

  it('is only for a binder the collector has on the server', async () => {
    expect((await api('ash', 'POST', '/api/shares', { binderId: 'johto' })).status).toBe(404)
    expect((await api('misty', 'POST', '/api/shares', { binderId: 'kanto' })).status).toBe(404)
    expect((await api('ash', 'POST', '/api/shares', { binderId: '../x' })).status).toBe(400)
    expect((await api('ash', 'POST', '/api/shares', {})).status).toBe(400)
  })

  it('makes links that cannot be guessed from one another', () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken))

    expect(tokens.size).toBe(200)
  })
})

describe('a database from before links could forbid copying', () => {
  it('gets what it lacks, and its links allow copying as they always did', async () => {
    const database = createTestDatabase()
    await database
      .prepare('CREATE TABLE shares (token TEXT PRIMARY KEY, user TEXT NOT NULL, binder_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (user, binder_id))')
      .run()
    await database.prepare("INSERT INTO shares (token, user, binder_id, created_at) VALUES ('old-link-0123456789abcd', 'ash', 'kanto', ?)").bind(monday).run()
    const old = createD1Store(database, createTestBucket())

    expect(await old.listShares('ash')).toEqual([{ token: 'old-link-0123456789abcd', binderId: 'kanto', createdAt: monday, copyable: true }])
    expect(await old.setShareCopyable('ash', 'old-link-0123456789abcd', false)).toBe(true)
    expect((await old.findShare('old-link-0123456789abcd'))?.copyable).toBe(false)
    // a second start finds the column there and leaves it alone
    const again = createD1Store(database, createTestBucket())
    expect((await again.findShare('old-link-0123456789abcd'))?.copyable).toBe(false)
  })
})

describe('what a link shows', () => {
  it('shows the binder as it is now, to anybody, without saying whose it is', async () => {
    const token = await share('ash', 'kanto')

    const first = await open(`/shared/${token}`)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    expect(await first.json()).toEqual({ binder: binder('kanto'), copyable: true })

    await api('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', tuesday, 'Kanto komplett'), base: monday })
    const text = await (await open(`/shared/${token}`)).text()
    expect(text).toContain('Kanto komplett')
    expect(text).not.toContain('ash')
  })

  it('says whether the binder may be copied, as its collector has set it', async () => {
    const token = await share('ash', 'kanto')
    const copyable = async () => ((await (await open(`/shared/${token}`)).json()) as { copyable: boolean }).copyable
    // a link allows it until it is switched off
    expect(await copyable()).toBe(true)
    expect(await (await api('ash', 'GET', '/api/shares')).json()).toMatchObject({ shares: [{ token, copyable: true }] })

    // nobody else can change that, and it takes a yes or a no
    expect((await api('misty', 'PUT', `/api/shares/${token}`, { copyable: false })).status).toBe(404)
    expect((await api('ash', 'PUT', `/api/shares/${token}`, { copyable: 'no' })).status).toBe(400)
    expect(await copyable()).toBe(true)

    expect((await api('ash', 'PUT', `/api/shares/${token}`, { copyable: false })).status).toBe(200)
    expect(await copyable()).toBe(false)
    expect(await (await api('ash', 'GET', '/api/shares')).json()).toMatchObject({ shares: [{ token, copyable: false }] })
    // asking for the link again keeps what was set
    expect(await share('ash', 'kanto')).toBe(token)
    expect(await copyable()).toBe(false)
    expect((await api('ash', 'PUT', `/api/shares/${token}`, { copyable: true })).status).toBe(200)
    expect(await copyable()).toBe(true)
  })

  it('leaves out the cards laid aside while the binder is rearranged', async () => {
    const laid = { ...binder('kanto'), tray: [{ id: 't1', cardRef: { cardId: 'sv03.5-006', lang: 'de', variant: 'holo' }, owned: true }] }
    await api('ash', 'PUT', '/api/binders/kanto', { binder: laid, base: monday })
    const token = await share('ash', 'kanto')

    const shown = (await (await open(`/shared/${token}`)).json()) as { binder: Record<string, unknown> }
    expect(shown.binder).not.toHaveProperty('tray')
    expect(shown.binder.id).toBe('kanto')
    // the collector still gets them
    const own = (await (await api('ash', 'GET', '/api/binders/kanto')).json()) as { binder: Record<string, unknown> }
    expect(own.binder.tray).toHaveLength(1)
  })

  it('hands out the pictures of that binder and no others', async () => {
    await upload('ash', 'forest', [1, 2, 3])
    await upload('ash', 'private', [9, 9, 9])
    const token = await share('ash', 'kanto')

    const picture = await open(`/shared/${token}/assets/forest`)
    expect(picture.status).toBe(200)
    expect(picture.headers.get('content-type')).toBe('image/png')
    expect([picture.headers.get('x-image-width'), picture.headers.get('x-image-height')]).toEqual(['30', '20'])
    expect([...new Uint8Array(await picture.arrayBuffer())]).toEqual([1, 2, 3])
    // an image of the same collector that the binder does not show
    expect((await open(`/shared/${token}/assets/private`)).status).toBe(404)
    // one the binder names but the server does not have
    expect((await open(`/shared/${token}/assets/cover`)).status).toBe(404)
  })

  it('shows nothing else of the collector', async () => {
    await api('ash', 'PUT', '/api/binders/johto', { binder: binder('johto'), base: null })
    const token = await share('ash', 'kanto')

    expect((await open(`/shared/${token}/binders`)).status).toBe(404)
    expect((await open(`/shared/${token}/assets/forest/more`)).status).toBe(404)
    expect((await open(`/shared/${token}`, 'DELETE')).status).toBe(405)
    expect((await open('/shared/johto')).status).toBe(404)
    // a link that differs in its last character; the token may end in "x" itself
    const other = `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`
    expect((await open(`/shared/${other}`)).status).toBe(404)
  })

  it('stops working when the link is withdrawn or the binder deleted', async () => {
    const token = await share('ash', 'kanto')

    // nobody else can withdraw it
    expect((await api('misty', 'DELETE', `/api/shares/${token}`)).status).toBe(404)
    expect((await open(`/shared/${token}`)).status).toBe(200)
    expect((await api('ash', 'DELETE', `/api/shares/${token}`)).status).toBe(200)
    expect((await open(`/shared/${token}`)).status).toBe(404)
    expect((await api('ash', 'DELETE', `/api/shares/${token}`)).status).toBe(404)

    // a new link is another link
    const again = await share('ash', 'kanto')
    expect(again).not.toBe(token)
    await api('ash', 'DELETE', '/api/binders/kanto', { deletedAt: tuesday, base: monday })
    expect((await open(`/shared/${again}`)).status).toBe(404)
  })
})

describe('imagesOfBinder', () => {
  it('names the cover picture and the pictures behind the pockets', () => {
    expect([...imagesOfBinder(JSON.stringify(binder('kanto')))].sort()).toEqual(['cover', 'forest'])
    expect(imagesOfBinder('not json').size).toBe(0)
    expect(imagesOfBinder(JSON.stringify({ pages: 'none', cover: null })).size).toBe(0)
  })
})

describe('looking at a shared binder in the app', () => {
  /** A real binder: a card that is there, a picture behind a pocket and one on the cover. */
  function realBinder() {
    let result = createBinder({ name: 'Johto', layout: '3x3' })
    const page = result.pages[0]
    if (!page) throw new Error('a page expected')
    const position = { pageId: page.id, slotIndex: 0 }
    result = setOwned(setCard(result, position, { cardId: 'neo1-1', lang: 'de', variant: 'holo' }), position, true)
    const placed = placeImage(result, page.id, 'forest', { fromSlot: 4, spanCols: 2, spanRows: 1 })
    if (!placed.ok) throw new Error(placed.error)
    return setCover(placed.binder, { title: 'Johto', assetId: 'cover' })
  }
  const send = (path: string) => open(path)

  it('gets the binder as it was shared, with the pictures the server has', async () => {
    const johto = realBinder()
    await api('ash', 'PUT', `/api/binders/${johto.id}`, { binder: johto, base: null })
    await upload('ash', 'forest', [1, 2, 3])
    const token = await share('ash', johto.id)

    const shared = await loadSharedBinder(token, send)

    expect(shared.binder).toEqual(johto)
    // the cover picture never reached the server: the binder is shown without it
    expect(shared.assets.map((asset) => [asset.id, asset.mimeType, asset.width, asset.height])).toEqual([
      ['forest', 'image/png', 30, 20],
    ])
    expect([...new Uint8Array(await shared.assets[0]?.blob.arrayBuffer() ?? new ArrayBuffer(0))]).toEqual([1, 2, 3])
  })

  it('says so when the link is not valid, or what it leads to is no binder', async () => {
    await expect(loadSharedBinder('a'.repeat(24), send)).rejects.toBeInstanceOf(SharedNotFoundError)
    // the stored thing is not a binder this app can show
    const token = await share('ash', 'kanto')
    await expect(loadSharedBinder(token, send)).rejects.toBeInstanceOf(SharedNotFoundError)
    // where there is no server part, the app's own page answers
    const page = () => Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))
    await expect(loadSharedBinder(token, page)).rejects.toBeInstanceOf(SharedNotFoundError)
  })

  it('tells a share link from any other address', () => {
    const token = newShareToken()

    expect(shareUrl(token, 'https://pokebinder.example')).toBe(`https://pokebinder.example/?share=${token}`)
    expect(shareTokenOf(`?share=${token}`)).toBe(token)
    expect(shareTokenOf('')).toBeUndefined()
    expect(shareTokenOf('?share=kurz')).toBeUndefined()
    expect(shareTokenOf('?share=../../api/me')).toBeUndefined()
  })
})
