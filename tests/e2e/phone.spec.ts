import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// A phone held upright: no mouse, and room for one thing at a time.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

const bar = (page: Page) => page.getByRole('navigation', { name: 'Bereich' })
const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).tap()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).tap()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  // what a phone tells the page: nothing can hover, and what points is coarse
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'hover', value: 'none' },
      { name: 'pointer', value: 'coarse' },
    ],
  })
  await page.goto('/')
})

test('a phone shows binder, search and selection one at a time, switched by a bar at the bottom', async ({ page }) => {
  // the shelf first; the bar is there from the start
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
  await expect(bar(page).getByRole('button')).toHaveText(['Binder', 'Suche', 'Auswahl'])
  expect(await noSidewaysScroll(page)).toBe(true)

  await createBinder(page, 'Handy')
  const left = page.getByTestId('column-left')
  const centre = page.getByTestId('column-center')
  const right = page.getByTestId('column-right')
  await expect(centre).toBeVisible()
  await expect(left).toBeHidden()
  await expect(right).toBeHidden()
  // the binder has the whole width
  expect((await centre.boundingBox())?.width).toBe(390)
  // no tabs on the edges here: the bar does their work
  await expect(page.getByRole('button', { name: /Suche (ein|aus)blenden/ })).toHaveCount(0)

  await bar(page).getByRole('button', { name: 'Suche' }).tap()
  await expect(left).toBeVisible()
  await expect(centre).toBeHidden()
  expect((await left.boundingBox())?.width).toBe(390)
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await expect(page.getByTestId('search-results').getByTestId('card-tile').first()).toBeVisible()

  await bar(page).getByRole('button', { name: 'Auswahl' }).tap()
  await expect(right).toBeVisible()
  await expect(left).toBeHidden()
  await expect(right).toContainText('Kein Pocket ausgewählt.')

  // back at the binder, what was typed in the search is still there
  await bar(page).getByRole('button', { name: 'Binder' }).tap()
  await expect(centre).toBeVisible()
  await bar(page).getByRole('button', { name: 'Suche' }).tap()
  await expect(page.getByRole('searchbox', { name: 'Name, Set oder Nummer' })).toHaveValue('Glurak')
  expect(await noSidewaysScroll(page)).toBe(true)
})

test('on a phone the binder lies open one page at a time, as wide as the screen', async ({ page }) => {
  await createBinder(page, 'Seiten')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  const label = page.getByTestId('spread-label')
  const pages = page.getByTestId('binder-page')

  // one page, no cover beside it, and the new page is the one shown
  await expect(label).toHaveText('Seite 3')
  await expect(pages).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Cover-Innenseite' })).toHaveCount(0)
  // it fills the width without reaching past it
  const spread = await page.getByTestId('binder-spread').boundingBox()
  expect(spread?.width).toBeGreaterThan(300)
  expect((spread?.x ?? 0) + (spread?.width ?? 0)).toBeLessThanOrEqual(390)
  expect(await noSidewaysScroll(page)).toBe(true)
  // nine pockets a finger can hit
  await expect(page.getByTestId('pocket')).toHaveCount(9)
  expect((await page.getByTestId('pocket').first().boundingBox())?.width).toBeGreaterThan(85)

  // page by page, with the arrows and the thumbnails
  await page.getByRole('button', { name: 'Zurückblättern' }).tap()
  await expect(label).toHaveText('Seite 2')
  await page.getByRole('button', { name: 'Zurückblättern' }).tap()
  await expect(label).toHaveText('Seite 1')
  await expect(page.getByRole('button', { name: 'Zurückblättern' })).toBeDisabled()
  await expect(page.getByTestId('mini-page')).toHaveCount(3)
  await page.getByRole('button', { name: 'Seite 3', exact: true }).tap()
  await expect(label).toHaveText('Seite 3')
  await expect(page.getByRole('button', { name: 'Weiterblättern' })).toBeDisabled()

  // the zoom is the app's business here
  await expect(page.getByRole('group', { name: 'Zoom' })).toBeHidden()
})

test('on a phone a pocket is picked in the binder and looked at under "Auswahl"', async ({ page }) => {
  await createBinder(page, 'Auswahl')
  await page.getByTestId('pocket').nth(4).tap()
  await expect(page.getByTestId('pocket').nth(4)).toHaveAttribute('aria-pressed', 'true')

  await bar(page).getByRole('button', { name: 'Auswahl' }).tap()
  const right = page.getByTestId('column-right')
  await expect(right).toContainText('Leerer Pocket')
  await expect(right.getByRole('button', { name: 'Pocket leeren' })).toBeVisible()
  // the page of the pocket: one more of it, shown right away back in the binder
  await right.getByRole('button', { name: 'Leere Seite davor' }).tap()
  await bar(page).getByRole('button', { name: 'Binder' }).tap()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 2')
  await expect(page.getByTestId('mini-page')).toHaveCount(2)
})

test('on a phone the menus come up from the bottom and close at a tap beside them', async ({ page }) => {
  await createBinder(page, 'Menüs')
  for (const name of ['Sortieren', 'Fehlliste', 'Als PNG', 'Mehr', 'Backup']) {
    await page.getByRole('button', { name, exact: true }).tap()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    // over (almost) the whole width, within the screen, above the bar
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
    expect(box?.width).toBeGreaterThan(330)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844 - 56)
    await page.getByRole('heading', { name: 'Menüs' }).tap()
    await expect(menu).toHaveCount(0)
  }
})

test('on a phone the shelf and the page "Karten" stand in two columns', async ({ page }) => {
  for (const name of ['Erster', 'Zweiter', 'Dritter']) {
    await createBinder(page, name)
    await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).tap()
  }
  const tiles = page.getByTestId('binder-tile')
  await expect(tiles).toHaveCount(3)
  const [first, second, third] = await Promise.all([0, 1, 2].map((index) => tiles.nth(index).boundingBox()))
  expect(first?.y).toBe(second?.y)
  expect(third?.y).toBeGreaterThan(first?.y ?? 0)
  expect(await noSidewaysScroll(page)).toBe(true)

  await page.getByRole('banner').getByRole('button', { name: 'Karten' }).tap()
  // the bar belongs to the binder; this page has none
  await expect(bar(page)).toHaveCount(0)
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).tap()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).tap()
  const cards = page.getByTestId('browse-results').getByTestId('card-tile')
  await expect(cards.first()).toBeVisible()
  const tops = await cards.evaluateAll((entries) => entries.slice(0, 4).map((entry) => entry.getBoundingClientRect().top))
  expect(tops[0]).toBe(tops[1])
  expect(tops[2]).toBeGreaterThan(tops[0] ?? 0)
  expect(await page.getByTestId('page').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true)

  // back to the shelf, the bar is there again
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).tap()
  await expect(bar(page)).toBeVisible()
})
