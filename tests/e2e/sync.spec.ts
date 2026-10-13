import type { Browser, Page, Route } from '@playwright/test'
import { expect, mockTcgdex, test } from './fixtures'
import { makePng, pngFile } from './png'

/**
 * A stand-in for the server part, shared by the "devices" of a test: it keeps what it is
 * given under the same rule as worker/api.ts (a device may only write over what it saw).
 */
interface FakeServer {
  email: string | null
  binders: Map<string, { updatedAt: string; deleted: boolean; data: unknown }>
  decks: Map<string, { updatedAt: string; deleted: boolean; data: unknown }>
  lists: { updatedAt: string; lists: unknown } | null
  images: Map<string, { record: Record<string, unknown>; body: Buffer }>
  /** Share links: token → binder id. */
  shares: Map<string, string>
  /** The links whose binder is not offered to be copied. */
  noCopy: Set<string>
}

const newServer = (): FakeServer => ({ email: 'ash@example.com', binders: new Map(), decks: new Map(), lists: null, images: new Map(), shares: new Map(), noCopy: new Set() })

/** A device with its own connection, which can be cut. */
interface Connection {
  online: boolean
}

async function connect(page: Page, server: FakeServer): Promise<Connection> {
  const connection: Connection = { online: true }
  // what a share link shows needs no sign-in
  await page.route('**/shared/**', (route: Route) => {
    const [, , token] = new URL(route.request().url()).pathname.split('/')
    const binder = server.binders.get(server.shares.get(token ?? '') ?? '')
    return binder && !binder.deleted
      ? route.fulfill({ json: { binder: binder.data, copyable: !server.noCopy.has(token ?? '') } })
      : route.fulfill({ status: 404, json: { error: 'not found' } })
  })
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
      deck?: { updatedAt: string }
      base?: string | null
      deletedAt?: string
      updatedAt?: string
      lists?: unknown
    } | null
    if (server.email === null) return route.fulfill({ status: 401, json: { error: 'not signed in' } })

    if (resource === 'me') return route.fulfill({ json: { email: server.email } })
    if (resource === 'shares') {
      if (method === 'GET') {
        return route.fulfill({
          json: { shares: [...server.shares].map(([token, binderId]) => ({ token, binderId, copyable: !server.noCopy.has(token) })) },
        })
      }
      if (method === 'PUT') {
        if (!server.shares.has(id ?? '')) return route.fulfill({ status: 404, json: { error: 'not found' } })
        const { copyable } = request.postDataJSON() as { copyable: boolean }
        if (copyable) server.noCopy.delete(id ?? '')
        else server.noCopy.add(id ?? '')
        return route.fulfill({ json: { token: id, copyable } })
      }
      if (method === 'DELETE') {
        return server.shares.delete(id ?? '')
          ? route.fulfill({ json: { token: id } })
          : route.fulfill({ status: 404, json: { error: 'not found' } })
      }
      const binderId = (request.postDataJSON() as { binderId?: string }).binderId ?? ''
      if (!server.binders.has(binderId)) return route.fulfill({ status: 404, json: { error: 'not found' } })
      const known = [...server.shares].find(([, shared]) => shared === binderId)?.[0]
      const token = known ?? `link${String(server.shares.size + 1).padStart(20, '0')}`
      server.shares.set(token, binderId)
      return route.fulfill({ json: { share: { token, binderId, copyable: !server.noCopy.has(token) } } })
    }
    if ((resource === 'binders' || resource === 'decks') && id === undefined) {
      const entries = [...server[resource]].map(([key, entry]) => ({
        id: key,
        updatedAt: entry.updatedAt,
        deleted: entry.deleted,
      }))
      return route.fulfill({ json: { [resource]: entries } })
    }
    if ((resource === 'binders' || resource === 'decks') && id !== undefined) {
      const one = resource === 'binders' ? 'binder' : 'deck'
      const current = server[resource].get(id)
      if (method === 'GET') {
        return current && !current.deleted
          ? route.fulfill({ json: { [one]: current.data } })
          : route.fulfill({ status: 404, json: { error: 'not found' } })
      }
      const updatedAt = method === 'PUT' ? body?.[one]?.updatedAt : body?.deletedAt
      if (updatedAt === undefined) return route.fulfill({ status: 400, json: { error: 'body' } })
      const allowed = current ? current.updatedAt === updatedAt || current.updatedAt === body?.base : body?.base === null
      if (!allowed) return route.fulfill({ status: 409, json: { current: null } })
      server[resource].set(id, { updatedAt, deleted: method === 'DELETE', data: body?.[one] })
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
  // in the app right away, as the first device is (see fixtures.ts)
  await page.addInitScript(() => sessionStorage.setItem('pokebinder:visited', '1'))
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
  await page.getByRole('button', { name: 'Meine Karten' }).click()
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
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

  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
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
  await expect(status(phone.page)).toHaveText('1 Konflikt klären')
  // nothing was overwritten on either side
  await expect.poll(() => shelf(phone.page)).toEqual(['Vom Handy'])

  await status(phone.page).click()
  await phone.page.getByRole('menuitem', { name: '1 Konflikt klären' }).click()
  const dialog = phone.page.getByRole('dialog', { name: 'Auf zwei Geräten geändert' })
  await expect(dialog.getByRole('group', { name: /^Vom Handy/ })).toBeVisible()
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

test('a deck built on one device stands on the shelf of the other, with its cards', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await expect(status(page)).toHaveAttribute('data-status', 'synced')

  await page.getByTestId('deck-shelf').getByRole('button', { name: 'Neues Deck' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Deck' })
  await dialog.getByLabel('Name').fill('Donner')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Set', exact: true }).click()
  await main.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const bisasam = page.getByTestId('pick-results').locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: /ins Deck legen$/ })
  await bisasam.click()
  await bisasam.click()
  await expect.poll(() => (server.decks.values().next().value?.data as { cards?: { count: number }[] } | undefined)?.cards?.[0]?.count).toBe(2)

  const phone = await secondDevice(browser, server)
  const tile = phone.page.getByTestId('deck-tile')
  await expect(tile).toHaveAttribute('data-deck-name', 'Donner')
  await expect(tile.getByTestId('deck-box')).toContainText('2 / 60 Karten')

  // deleted on the phone, it goes from the first device too
  await phone.page.getByRole('button', { name: 'Deck Donner löschen' }).click()
  await phone.page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect.poll(() => [...server.decks.values()].map((entry) => entry.deleted)).toEqual([true])
  await syncNow(page)
  // the deck lay open there: it is put away
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
  await expect(page.getByTestId('deck-tile')).toHaveCount(0)
  await phone.close()
})

test('a binder is shared by a link that anybody can open to look at it, until the link is withdrawn', async ({
  page,
  browser,
}) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const wizard = page.getByRole('dialog', { name: 'Neuer Binder' })
  await wizard.getByText('Master Set', { exact: true }).click()
  await wizard.getByRole('button', { name: 'Set', exact: true }).click()
  await wizard.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(wizard.getByTestId('master-set-summary')).toBeVisible()
  await wizard.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  const first = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').first()
  await first.click()
  await expect(first).toHaveAttribute('data-owned', 'true')

  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  const dialog = page.getByRole('dialog', { name: '„151“ teilen' })
  await expect(dialog).toContainText('Für diesen Binder gibt es noch keinen Link.')
  await dialog.getByRole('button', { name: 'Link erzeugen' }).click()
  const link = await dialog.getByRole('textbox', { name: 'Link zum Binder' }).inputValue()
  expect(link).toMatch(/^http:\/\/localhost:\d+\/\?share=link0+1$/)
  // the binder went to the server first: that is what the link shows
  expect(server.binders.size).toBe(1)

  // somebody who is not signed in, on another device
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const visitor = await context.newPage()
  await visitor.route(/^https:/, (route) => route.abort())
  // the same server, but nobody is signed in on this device
  await connect(visitor, { ...server, email: null })
  await visitor.goto(link)

  await expect(visitor.getByRole('heading', { name: '151', exact: true })).toBeVisible()
  await expect(visitor.getByText('Geteilter Binder · nur zum Ansehen')).toBeVisible()
  await expect(visitor.getByTestId('shared-progress')).toHaveText('1 von 207 Karten vorhanden')
  const pockets = visitor.getByTestId('shared-pocket')
  await expect(pockets).toHaveCount(9)
  await expect(pockets.first()).toHaveAttribute('data-card-id', 'sv03.5-001')
  await expect(pockets.first()).toHaveAttribute('data-owned', 'true')
  await expect(pockets.nth(1)).toHaveAttribute('data-owned', 'false')
  // leafing through, but nothing to change with
  await visitor.getByRole('button', { name: 'Weiterblättern' }).click()
  await expect(visitor.getByTestId('shared-spread-label')).toHaveText('Seiten 2 – 3')
  await expect(visitor.getByRole('button', { name: 'Seite hinzufügen' })).toHaveCount(0)
  await expect(visitor.getByRole('group', { name: 'Modus' })).toHaveCount(0)
  // and nothing of it lands among the visitor's own binders
  await visitor.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await expect(visitor.getByTestId('binder-tile')).toHaveCount(0)

  // the same link again later shows the same; withdrawn, it shows nothing
  await page.getByRole('dialog', { name: '„151“ teilen' }).getByRole('button', { name: 'Link ungültig machen' }).click()
  await expect(dialog).toContainText('Für diesen Binder gibt es noch keinen Link.')
  await visitor.goto(link)
  await expect(visitor.getByRole('alert')).toContainText('Diesen Link gibt es nicht (mehr).')
  await context.close()
})

test('a shared binder is copied into one\'s own collection, unless its collector switched that off', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const wizard = page.getByRole('dialog', { name: 'Neuer Binder' })
  await wizard.getByText('Master Set', { exact: true }).click()
  await wizard.getByRole('button', { name: 'Set', exact: true }).click()
  await wizard.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(wizard.getByTestId('master-set-summary')).toBeVisible()
  await wizard.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  const owned = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').first()
  await owned.click()
  await expect(owned).toHaveAttribute('data-owned', 'true')
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  const dialog = page.getByRole('dialog', { name: '„151“ teilen' })
  await dialog.getByRole('button', { name: 'Link erzeugen' }).click()
  const link = await dialog.getByRole('textbox', { name: 'Link zum Binder' }).inputValue()
  // a link offers copying until that is switched off
  const allow = dialog.getByRole('checkbox', { name: /Darf in die eigene Sammlung kopiert werden/ })
  await expect(allow).toBeChecked()

  // a friend on another device, not signed in
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const visitor = await context.newPage()
  await visitor.route(/^https:/, (route) => route.abort())
  const friend = { ...server, email: null }
  await connect(visitor, friend)
  await visitor.goto(link)
  await expect(visitor.getByTestId('shared-progress')).toHaveText('1 von 207 Karten vorhanden')

  await visitor.getByRole('button', { name: 'In meine Sammlung kopieren' }).click()
  await expect(visitor.getByRole('status').filter({ hasText: 'Kopie' })).toContainText('Der Binder liegt jetzt als Kopie in deiner Sammlung.')
  await expect(visitor.getByRole('button', { name: 'In meine Sammlung kopieren' })).toHaveCount(0)
  await visitor.getByRole('button', { name: 'Kopie öffnen' }).click()

  // the copy is a binder of the friend's own: all cards missing, and it can be changed
  await expect(visitor.getByRole('heading', { name: '151', exact: true })).toBeVisible()
  await expect(visitor.getByTestId('progress')).toContainText('0 / 207 Karten gesammelt')
  const pockets = visitor.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket')
  await expect(pockets.first()).toHaveAttribute('data-card-id', 'sv03.5-001')
  await expect(pockets.first()).toHaveAttribute('data-owned', 'false')
  await visitor.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await pockets.nth(1).click()
  await expect(visitor.getByTestId('progress')).toContainText('1 / 207 Karten gesammelt')
  // it stays after a reload, among the friend's binders
  await expect(visitor.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')
  await visitor.goto('/')
  await visitor.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await expect(visitor.getByTestId('binder-tile')).toHaveCount(1)

  // what the friend changed did not touch the binder that was shared
  await visitor.goto(link)
  await expect(visitor.getByTestId('shared-progress')).toHaveText('1 von 207 Karten vorhanden')
  await expect(visitor.getByTestId('shared-pocket').nth(1)).toHaveAttribute('data-owned', 'false')
  expect(server.binders.size).toBe(1)

  // switched off by the collector, the link still shows the binder, without the offer
  await allow.uncheck()
  await expect.poll(() => server.noCopy.size).toBe(1)
  await visitor.goto(link)
  await expect(visitor.getByTestId('shared-progress')).toBeVisible()
  await expect(visitor.getByRole('button', { name: 'In meine Sammlung kopieren' })).toHaveCount(0)
  // the choice is kept with the link
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  await expect(page.getByRole('dialog', { name: '„151“ teilen' }).getByRole('checkbox')).not.toBeChecked()
  await context.close()
})

test('sharing asks to sign in first', async ({ page }) => {
  const server = newServer()
  server.email = null
  await connect(page, server)
  await page.goto('/')
  await createBinder(page, 'Privat')

  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  const dialog = page.getByRole('dialog', { name: '„Privat“ teilen' })

  await expect(dialog).toContainText('Zum Teilen musst du angemeldet sein')
  await expect(dialog.getByRole('button', { name: 'Link erzeugen' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Anmelden' })).toBeVisible()
})

/** A master set of "151" in which the card of one pocket of page 1 is there twice. */
async function masterSetWithSpare(page: Page, pocketNumber: number) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const wizard = page.getByRole('dialog', { name: 'Neuer Binder' })
  await wizard.getByText('Master Set', { exact: true }).click()
  await wizard.getByRole('button', { name: 'Set', exact: true }).click()
  await wizard.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(wizard.getByTestId('master-set-summary')).toBeVisible()
  await wizard.getByRole('button', { name: 'Anlegen' }).click()
  const pocket = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').nth(pocketNumber - 1)
  await pocket.click()
  await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Vorhanden' }).click()
  await page.getByRole('button', { name: 'Anzahl erhöhen' }).click()
  await expect(pocket.getByTestId('copies-badge')).toHaveText('×2')
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()
}

test('a shared binder is compared with one\'s own: who has spare what the other is missing', async ({ page, browser }) => {
  // the friend: Bisasam twice, everything else missing
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await masterSetWithSpare(page, 1)
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  await page.getByRole('button', { name: 'Link erzeugen' }).click()
  const link = await page.getByRole('textbox', { name: 'Link zum Binder' }).inputValue()

  // this collector, on another device and not signed in: Bisaknosp twice, everything else missing
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const mine = await context.newPage()
  await mine.addInitScript(() => sessionStorage.setItem('pokebinder:visited', '1'))
  await mockTcgdex(mine)
  await connect(mine, { ...server, email: null })
  await mine.goto('/')
  await masterSetWithSpare(mine, 2)

  await mine.goto(link)
  await mine.getByRole('button', { name: 'Tauschabgleich' }).click()
  const dialog = mine.getByRole('dialog', { name: 'Tauschabgleich mit „151“' })

  // the friend's spare Bisasam is missing here; the spare Bisaknosp of this device is missing there
  const forMe = dialog.getByTestId('trade-for-me')
  await expect(forMe.getByTestId('trade-row')).toHaveCount(1)
  await expect(forMe.getByTestId('trade-row')).toContainText('Bisasam')
  await expect(forMe.getByTestId('trade-row')).toContainText('151 · 001/165')
  const forThem = dialog.getByTestId('trade-for-them')
  await expect(forThem.getByTestId('trade-row')).toHaveCount(1)
  await expect(forThem.getByTestId('trade-row')).toContainText('Bisaknosp')
  await expect(forThem).toContainText(/Zusammen [0-9.,]+ €/)
  await context.close()
})

test('the comparison says so when this device has no binder of its own', async ({ page, browser }) => {
  const server = newServer()
  await connect(page, server)
  await page.goto('/')
  await masterSetWithSpare(page, 1)
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Teilen …' }).click()
  await page.getByRole('button', { name: 'Link erzeugen' }).click()
  const link = await page.getByRole('textbox', { name: 'Link zum Binder' }).inputValue()

  const context = await browser.newContext({ serviceWorkers: 'block' })
  const visitor = await context.newPage()
  await mockTcgdex(visitor)
  await connect(visitor, { ...server, email: null })
  await visitor.goto(link)
  await visitor.getByRole('button', { name: 'Tauschabgleich' }).click()
  const dialog = visitor.getByRole('dialog', { name: 'Tauschabgleich mit „151“' })

  await expect(dialog).toContainText('Auf diesem Gerät gibt es noch keinen eigenen Binder')
  await expect(dialog.getByTestId('trade-row')).toHaveCount(0)
  await context.close()
})
