// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { handleApi, MAX_JSON_BYTES } from './api'
import { createD1Store } from './d1Store'
import type { SyncStore } from './store'
import { createTestBucket, createTestDatabase } from './testing'

const monday = '2026-10-12T10:00:00.000Z'
const tuesday = '2026-10-13T10:00:00.000Z'
const wednesday = '2026-10-14T10:00:00.000Z'

let store: SyncStore
let bucket: ReturnType<typeof createTestBucket>

const call = (user: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handleApi(
    new Request(`https://pokebinder.example${path}`, {
      method,
      headers,
      ...(body === undefined
        ? {}
        : {
            body:
              body instanceof Uint8Array
                ? (body as Uint8Array<ArrayBuffer>)
                : typeof body === 'string'
                  ? body
                  : JSON.stringify(body),
          }),
    }),
    user,
    store,
  )

const binder = (id: string, updatedAt: string, name = 'Kanto') => ({ id, name, updatedAt, pages: [] })

beforeEach(() => {
  bucket = createTestBucket()
  store = createD1Store(createTestDatabase(), bucket)
})

describe('who is signed in', () => {
  it('says so', async () => {
    const response = await call('ash@example.com', 'GET', '/api/me')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: 'ash@example.com' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('binders', () => {
  it('keeps a binder and hands it back as it came', async () => {
    const stored = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })
    expect(stored.status).toBe(200)

    expect(await (await call('ash', 'GET', '/api/binders')).json()).toEqual({
      binders: [{ id: 'kanto', updatedAt: monday, deleted: false }],
    })
    expect(await (await call('ash', 'GET', '/api/binders/kanto')).json()).toEqual({ binder: binder('kanto', monday) })
  })

  it('takes a newer version from a device that saw the one before', async () => {
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })

    const response = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', tuesday, 'Neu'), base: monday })

    expect(response.status).toBe(200)
    expect(await (await call('ash', 'GET', '/api/binders/kanto')).json()).toMatchObject({ binder: { name: 'Neu' } })
  })

  it('turns a version away from a device that did not see what the server has', async () => {
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', tuesday, 'Vom Handy'), base: monday })

    // the other device still thinks the server has Monday's version
    const late = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', wednesday, 'Vom PC'), base: monday })

    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ current: { id: 'kanto', updatedAt: tuesday, deleted: false } })
    expect(await (await call('ash', 'GET', '/api/binders/kanto')).json()).toMatchObject({ binder: { name: 'Vom Handy' } })
    // and a device that thinks the binder is new when it is not
    const fresh = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', wednesday), base: null })
    expect(fresh.status).toBe(409)
  })

  it('takes the same change twice: an answer may get lost on the way', async () => {
    const first = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })
    const again = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })

    expect([first.status, again.status]).toEqual([200, 200])
  })

  it('keeps a deletion on record, so that other devices learn of it', async () => {
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })

    const response = await call('ash', 'DELETE', '/api/binders/kanto', { deletedAt: tuesday, base: monday })

    expect(response.status).toBe(200)
    expect(await (await call('ash', 'GET', '/api/binders')).json()).toEqual({
      binders: [{ id: 'kanto', updatedAt: tuesday, deleted: true }],
    })
    expect((await call('ash', 'GET', '/api/binders/kanto')).status).toBe(404)
    // a binder that was worked on elsewhere in the meantime is not deleted over that
    await call('ash', 'PUT', '/api/binders/johto', { binder: binder('johto', tuesday), base: null })
    const stale = await call('ash', 'DELETE', '/api/binders/johto', { deletedAt: wednesday, base: monday })
    expect(stale.status).toBe(409)
  })

  it('lets a binder come back after it was deleted', async () => {
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })
    await call('ash', 'DELETE', '/api/binders/kanto', { deletedAt: tuesday, base: monday })

    const back = await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', wednesday), base: tuesday })

    expect(back.status).toBe(200)
    expect(await (await call('ash', 'GET', '/api/binders')).json()).toEqual({
      binders: [{ id: 'kanto', updatedAt: wednesday, deleted: false }],
    })
  })

  it('keeps the binders of one collector from another', async () => {
    await call('ash', 'PUT', '/api/binders/kanto', { binder: binder('kanto', monday), base: null })

    expect(await (await call('misty', 'GET', '/api/binders')).json()).toEqual({ binders: [] })
    expect((await call('misty', 'GET', '/api/binders/kanto')).status).toBe(404)
    // the same id is another binder for another collector
    const own = await call('misty', 'PUT', '/api/binders/kanto', { binder: binder('kanto', tuesday, 'Mistys'), base: null })
    expect(own.status).toBe(200)
    expect(await (await call('ash', 'GET', '/api/binders/kanto')).json()).toMatchObject({ binder: { name: 'Kanto' } })
  })

  it('turns away what is not a binder for that address', async () => {
    const put = (body: unknown, path = '/api/binders/kanto') => call('ash', 'PUT', path, body)

    expect((await put({ binder: binder('other', monday), base: null })).status).toBe(400)
    expect((await put({ binder: { id: 'kanto' }, base: null })).status).toBe(400)
    expect((await put({ binder: binder('kanto', monday) })).status).toBe(400)
    expect((await put('not json')).status).toBe(400)
    expect((await put('[1,2]')).status).toBe(400)
    expect((await put({ binder: binder('a b', monday), base: null }, '/api/binders/a%20b')).status).toBe(400)
    expect((await put({ binder: { ...binder('kanto', monday), filler: 'x'.repeat(MAX_JSON_BYTES) }, base: null })).status).toBe(413)
    expect(await (await call('ash', 'GET', '/api/binders')).json()).toEqual({ binders: [] })
  })
})

describe('decks', () => {
  const deck = (id: string, updatedAt: string, name = 'Donner') => ({ id, name, updatedAt, cards: [] })

  it('are kept like binders, in a list of their own', async () => {
    await call('ash', 'PUT', '/api/binders/same', { binder: binder('same', monday), base: null })
    const stored = await call('ash', 'PUT', '/api/decks/same', { deck: deck('same', tuesday), base: null })
    expect(stored.status).toBe(200)

    expect(await (await call('ash', 'GET', '/api/decks')).json()).toEqual({
      decks: [{ id: 'same', updatedAt: tuesday, deleted: false }],
    })
    expect(await (await call('ash', 'GET', '/api/decks/same')).json()).toEqual({ deck: deck('same', tuesday) })
    // the binder with the same id is another thing
    expect(await (await call('ash', 'GET', '/api/binders/same')).json()).toEqual({ binder: binder('same', monday) })
    expect(await (await call('misty', 'GET', '/api/decks')).json()).toEqual({ decks: [] })
  })

  it('follow the same rule: a device may only write over what it saw', async () => {
    await call('ash', 'PUT', '/api/decks/donner', { deck: deck('donner', monday), base: null })
    await call('ash', 'PUT', '/api/decks/donner', { deck: deck('donner', tuesday, 'Vom Handy'), base: monday })

    const late = await call('ash', 'PUT', '/api/decks/donner', { deck: deck('donner', wednesday, 'Vom PC'), base: monday })
    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ current: { id: 'donner', updatedAt: tuesday, deleted: false } })

    const gone = await call('ash', 'DELETE', '/api/decks/donner', { deletedAt: wednesday, base: tuesday })
    expect(gone.status).toBe(200)
    expect((await call('ash', 'GET', '/api/decks/donner')).status).toBe(404)
    expect(await (await call('ash', 'GET', '/api/decks')).json()).toEqual({
      decks: [{ id: 'donner', updatedAt: wednesday, deleted: true }],
    })
    // what is sent must be a deck for that address, under its own word
    expect((await call('ash', 'PUT', '/api/decks/donner', { binder: deck('donner', wednesday), base: null })).status).toBe(400)
    expect((await call('ash', 'PUT', '/api/decks/donner', { deck: deck('other', wednesday), base: null })).status).toBe(400)
  })
})

describe('watchlists', () => {
  const lists = [{ id: 'quick', name: '', cards: [{ cardId: 'sv03.5-025', lang: 'de', savedAt: monday }] }]

  it('has none to begin with, then keeps what it is given', async () => {
    expect(await (await call('ash', 'GET', '/api/watchlists')).json()).toEqual({ updatedAt: null, lists: [] })

    const stored = await call('ash', 'PUT', '/api/watchlists', { updatedAt: monday, lists, base: null })

    expect(stored.status).toBe(200)
    expect(await (await call('ash', 'GET', '/api/watchlists')).json()).toEqual({ updatedAt: monday, lists })
    expect(await (await call('misty', 'GET', '/api/watchlists')).json()).toEqual({ updatedAt: null, lists: [] })
  })

  it('turns away lists from a device that did not see the ones the server has', async () => {
    await call('ash', 'PUT', '/api/watchlists', { updatedAt: monday, lists, base: null })
    await call('ash', 'PUT', '/api/watchlists', { updatedAt: tuesday, lists: [], base: monday })

    const late = await call('ash', 'PUT', '/api/watchlists', { updatedAt: wednesday, lists, base: monday })

    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ currentUpdatedAt: tuesday })
    expect((await call('ash', 'PUT', '/api/watchlists', { updatedAt: wednesday, lists: 'none', base: tuesday })).status).toBe(400)
  })
})

describe('images', () => {
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
  const upload = (user: string, id: string, type = 'image/png', query = '?width=300&height=200') =>
    call(user, 'PUT', `/api/assets/${id}${query}`, png, { 'content-type': type })

  it('keeps a picture and hands it back', async () => {
    expect((await upload('ash', 'forest', 'image/png', `?width=300&height=200&createdAt=${monday}`)).status).toBe(200)

    expect(await (await call('ash', 'GET', '/api/assets')).json()).toEqual({
      assets: [{ id: 'forest', mimeType: 'image/png', width: 300, height: 200, createdAt: monday }],
    })
    const picture = await call('ash', 'GET', '/api/assets/forest')
    expect(picture.headers.get('content-type')).toBe('image/png')
    expect(picture.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await picture.arrayBuffer())).toEqual(png)
  })

  it('keeps the pictures of one collector from another', async () => {
    await upload('ash', 'forest')

    expect((await call('misty', 'GET', '/api/assets/forest')).status).toBe(404)
    expect(await (await call('misty', 'GET', '/api/assets')).json()).toEqual({ assets: [] })
    expect(bucket.keys()).toEqual(['ash/forest'])
  })

  it('turns away what is no picture of a kind the app makes, or has no size', async () => {
    expect((await upload('ash', 'a', 'text/html')).status).toBe(415)
    expect((await upload('ash', 'a', 'image/svg+xml')).status).toBe(415)
    expect((await upload('ash', 'a', 'image/png', '')).status).toBe(400)
    expect((await upload('ash', 'a', 'image/png', '?width=0&height=10')).status).toBe(400)
    expect((await upload('ash', '..%2Fmisty', 'image/png')).status).toBe(400)
    expect(bucket.keys()).toEqual([])
  })
})

describe('everything else', () => {
  it('is not there', async () => {
    expect((await call('ash', 'GET', '/api/nothing')).status).toBe(404)
    expect((await call('ash', 'GET', '/api/binders/a/b')).status).toBe(404)
    expect((await call('ash', 'POST', '/api/binders')).status).toBe(405)
    expect((await call('ash', 'DELETE', '/api/me')).status).toBe(405)
  })
})
