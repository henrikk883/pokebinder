import type { Browser, Page, Route } from '@playwright/test'
import { expect, test } from './fixtures'
import { makePng, pngFile } from './png'

/**
 * A stand-in for the server part, shared by the "devices" of a test: it keeps what it is
 * given under the same rule as worker/api.ts (a device may only write over what it saw).
 */
interface FakeServer {
  email: string | null
  binders: Map<string, { updatedAt: string; deleted: boolean; data: unknown }>
  lists: { updatedAt: string; lists: unknown } | null
  images: Map<string, { record: Record<string, unknown>; body: Buffer }>
}

const newServer = (): FakeServer => ({ email: 'ash@example.com', binders: new Map(), lists: null, images: new Map() })

/** A device with its own connection, which can be cut. */
interface Connection {
  online: boolean
}

async function connect(page: Page, server: FakeServer): Promise<Connection> {
  const connection: Connection = { online: true }
  await page.route('**/api/**', (route: Route) => {
    if (!connection.online) return route.abort('internetdisconnected')
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    const method = request.method()
    const [, , resource, id] = pathname.split('/')
    if (server.email !== null && resource === 'assets') {
      if (id === undefined) return route.fulfill({ json: { assets: [...server.images.values()].map((image) => image.record) } })
      const image = server.images.get(id)
      if (method === 'GET') {
        return image
          ? route.fulfill({ contentType: String(image.record.mimeType), body: image.body })
          : route.fulfill({ status: 404, json: { error: 'not found' } })
      }
      const record = {
        id,
        mimeType: request.headers()['content-type'] ?? '',
        width: Number(searchParams.get('width')),
        height: Number(searchParams.get('height')),
        createdAt: searchParams.get('createdAt') ?? undefined,
      }
      if (!image) server.images.set(id, { record, body: request.postDataBuffer() ?? Buffer.alloc(0) })
      return route.fulfill({ json: { id } })
    }
    const body = (method === 'PUT' || method === 'DELETE' ? request.postDataJSON() : null) as {
      binder?: { updatedAt: string }
      base?: string | null
      deletedAt?: string
      updatedAt?: string
      lists?: unknown
    } | null
    if (server.email === null) return route.fulfill({ status: 401, json: { error: 'not signed in' } })

    if (resource === 'me') return route.fulfill({ json: { email: server.email } })
    if (resource === 'binders' && id === undefined) {
      const binders = [...server.binders].map(([key, entry]) => ({
        id: key,
        updatedAt: entry.updatedAt,
        deleted: entry.deleted,
      }))
      return route.fulfill({ json: { binders } })
    }
    if (resource === 'binders' && id !== undefined) {
      const current = server.binders.get(id)
      if (method === 'GET') {
        return current && !current.deleted
          ? route.fulfill({ json: { binder: current.data } })
          : route.fulfill({ status: 404, json: { error: 'not found' } })
      }
      const updatedAt = method === 'PUT' ? body?.binder?.updatedAt : body?.deletedAt
      if (updatedAt === undefined) return route.fulfill({ status: 400, json: { error: 'body' } })
      const allowed = current ? current.updatedAt === updatedAt || current.updatedAt === body?.base : body?.base === null
      if (!allowed) return route.fulfill({ status: 409, json: { current: null } })
      server.binders.set(id, { updatedAt, deleted: method === 'DELETE', data: body?.binder })
      return route.fulfill({ json: { updatedAt } })
    }
    if (resource === 'watchlists') {
      if (method === 'GET') return route.fulfill({ json: server.lists ?? { updatedAt: null, lists: [] } })
      if ((server.lists?.updatedAt ?? null) !== body?.base) {
        return route.fulfill({ status: 409, json: { currentUpdatedAt: server.lists?.updatedAt ?? null } })
      }
      server.lists = { updatedAt: body?.updatedAt ?? '', lists: body?.lists }
      return route.fulfill({ json: { updatedAt: body?.updatedAt } })
    }
    return route.fulfill({ status: 404, json: { error: 'not found' } })
  })
  return connection
}

/** Another device of the same collector: its own browser storage, the same server. */
async function secondDevice(browser: Browser, server: FakeServer) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  // the shelf needs nothing from outside
  await page.route(/^https:/, (route) => route.abort())
  const connection = await connect(page, server)
  await page.goto('/')
  return { page, connection, close: () => context.close() }
}

const status = (page: Page) => page.getByTestId('sync-status')
const shelf = (page: Page) =>
  page.getByTestId('binder-tile').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-binder-name')))

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

async function toShelf(page: Page) {
  await page.getByRole('button', { name: 'Meine Binder' }).click()
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
}

async function renameOnShelf(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: `${from} umbenennen` }).click()
  const dialog = page.getByRole('dialog', { name: 'Binder umbenennen' })
  await dialog.getByLabel('Name').fill(to)
  await dialog.getByRole('button', { name: 'Umbenennen' }).click()
  await expect.poll(() => shelf(page)).toEqual([to])
}

async function syncNow(page: Page) {
  await status(page).click()
  await page.getByRole('menuitem', { name: 'Jetzt abgleichen' }).click()
}

test('where there is no server part, nothing about sync is shown', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0)
  await expect(status(page)).toHaveCount(0)
})

test('a collector who is not signed in is offered to; the app works as before', async ({ page }) => {
  const server = newServer()
  server.email = null
  await connect(page, server)
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await createBinder(page, 'Ohne Anmeldung')
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()
  expect(server.binders.size).toBe(0)

  // signing in is a trip to the server, which sends the browser back to where it was
  const login = page.waitForRequest((request) => request.url().includes('/api/login?return=%2F'))
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await login
})

test('a binder made on one device appears on the other; deleted there, it goes here too', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await expect(status(page)).toHaveAttribute('data-status', 'synced')

  await createBinder(page, 'Kanto')
  await expect.poll(() => server.binders.size).toBe(1)

  const phone = await secondDevice(browser, server)
  await expect.poll(() => shelf(phone.page)).toEqual(['Kanto'])
  await status(phone.page).click()
  await expect(phone.page.getByRole('menu', { name: 'Abgleich' })).toContainText('Angemeldet als ash@example.com')
  await phone.page.keyboard.press('Escape')

  await phone.page.getByRole('button', { name: 'Kanto löschen' }).click()
  await phone.page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect.poll(() => [...server.binders.values()].map((entry) => entry.deleted)).toEqual([true])

  // the binder lies open on the first device: it is put away
  await syncNow(page)
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
  await expect.poll(() => shelf(page)).toEqual([])
  await phone.close()
})

test('changes made without a connection are sent later; a binder changed on both devices is asked about', async ({
  page,
  browser,
}) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await createBinder(page, 'Kanto')
  await expect.poll(() => server.binders.size).toBe(1)
  await toShelf(page)

  const phone = await secondDevice(browser, server)
  await expect.poll(() => shelf(phone.page)).toEqual(['Kanto'])

  // the phone loses its connection and is worked on all the same
  phone.connection.online = false
  await renameOnShelf(phone.page, 'Kanto', 'Vom Handy')
  await expect(status(phone.page)).toHaveAttribute('data-status', 'offline')

  await renameOnShelf(page, 'Kanto', 'Vom PC')
  await expect.poll(() => (server.binders.values().next().value?.data as { name: string }).name).toBe('Vom PC')

  phone.connection.online = true
  await syncNow(phone.page)
  await expect(status(phone.page)).toHaveAttribute('data-status', 'conflict')
  await expect(status(phone.page)).toHaveText('1 Binder klären')
  // nothing was overwritten on either side
  await expect.poll(() => shelf(phone.page)).toEqual(['Vom Handy'])

  await status(phone.page).click()
  await phone.page.getByRole('menuitem', { name: '1 Binder klären' }).click()
  const dialog = phone.page.getByRole('dialog', { name: 'Auf zwei Geräten geändert' })
  await expect(dialog.getByRole('group', { name: 'Vom Handy' })).toBeVisible()
  await dialog.getByRole('radio', { name: /^Dieses Gerät/ }).check()
  await dialog.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(status(phone.page)).toHaveAttribute('data-status', 'synced')

  await syncNow(page)
  await expect.poll(() => shelf(page)).toEqual(['Vom Handy'])
  await phone.close()
})

test('what is noted on one device is on the lists of the other', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await expect(status(page)).toHaveAttribute('data-status', 'synced')

  await page.evaluate(() => {
    // as if noted on this device before it ever synced
    localStorage.setItem(
      'pokebinder:watchlists',
      JSON.stringify([{ id: 'quick', name: '', cards: [{ cardId: 'sv03.5-025', lang: 'de', savedAt: '2026-10-12T10:00:00.000Z' }] }]),
    )
  })
  await page.reload()
  await expect.poll(() => server.lists !== null).toBe(true)

  const phone = await secondDevice(browser, server)
  await expect
    .poll(() => phone.page.evaluate(() => localStorage.getItem('pokebinder:watchlists') ?? ''))
    .toContain('sv03.5-025')
  await phone.close()
})

test('an own image lying in a binder is shown on the other device too', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await createBinder(page, 'Kanto')
  const first = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').first()
  await first.click()
  await page.getByLabel('Bild hinzufügen').setInputFiles(pngFile('wald.png', makePng(600, 300, [20, 120, 40], [200, 230, 90])))
  await expect(first).toHaveAttribute('data-over-image', 'true')
  await expect.poll(() => server.images.size).toBe(1)
  expect([...server.images.values()][0]?.record).toMatchObject({ mimeType: 'image/png', width: 600, height: 300 })

  const phone = await secondDevice(browser, server)
  await phone.page.getByRole('button', { name: 'Kanto öffnen' }).click()
  const image = phone.page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('placed-image').locator('img').first()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await phone.close()
})
