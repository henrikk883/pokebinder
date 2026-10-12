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

  await page.getByRole('banner').getByRole('button', { name: 'Stöbern' }).tap()
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

test('on a phone a tapped card goes into the selected pocket, and the next free pocket is up next', async ({ page }) => {
  await createBinder(page, 'Antippen')
  const pockets = page.getByTestId('pocket')
  const hint = page.getByTestId('tap-hint')
  const toSearch = () => bar(page).getByRole('button', { name: 'Suche' }).tap()
  const toBinder = () => bar(page).getByRole('button', { name: 'Binder' }).tap()

  // nothing selected: the first free pocket of the open page is where a card would go
  await toSearch()
  await expect(hint).toHaveText('Karte antippen legt sie in Seite 1 · Pocket 1')
  await page.getByRole('button', { name: 'Set', exact: true }).tap()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).tap()
  const results = page.getByTestId('search-results')
  const card = (cardId: string) => results.locator(`[data-card-id="${cardId}"]`)
  await expect(card('sv03.5-001')).toBeVisible()

  // a tap puts the card there and says so; the next pocket is up
  await card('sv03.5-001').getByRole('button', { name: 'Bisasam in den Binder legen' }).tap()
  await expect(hint.getByRole('status')).toHaveText('✓ Bisasam liegt in Seite 1 · Pocket 1')
  await expect(hint).toContainText('Karte antippen legt sie in Seite 1 · Pocket 2')
  await card('sv03.5-002').getByRole('button', { name: /in den Binder legen$/ }).tap()
  await expect(hint).toContainText('Seite 1 · Pocket 3')

  // in the binder both lie there, and the pocket that is up next is the one selected
  await toBinder()
  await expect(pockets.nth(0)).toHaveAttribute('data-card-id', 'sv03.5-001')
  await expect(pockets.nth(1)).toHaveAttribute('data-card-id', 'sv03.5-002')
  await expect(pockets.nth(2)).toHaveAttribute('aria-pressed', 'true')

  // a pocket picked in the binder is where the next card goes
  await pockets.nth(8).tap()
  await toSearch()
  await expect(hint).toContainText('Karte antippen legt sie in Seite 1 · Pocket 9')
  await card('sv03.5-003').getByRole('button', { name: /in den Binder legen$/ }).tap()
  await expect(hint.getByRole('status')).toHaveText(/liegt in Seite 1 · Pocket 9$/)
  // behind the last pocket nothing is free: back to the first free pocket of the page
  await expect(hint).toContainText('Karte antippen legt sie in Seite 1 · Pocket 3')
  await toBinder()
  await expect(pockets.nth(8)).toHaveAttribute('data-card-id', 'sv03.5-003')

  // info and star still do their own thing and put nothing into the binder
  await toSearch()
  await card('sv03.5-004').scrollIntoViewIfNeeded()
  await card('sv03.5-004').getByRole('button', { name: /^Infos zu/ }).tap()
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).tap()
  await card('sv03.5-004').getByRole('button', { name: /merken$/ }).tap()
  await toBinder()
  await expect(page.locator('[data-testid="pocket"]:not([data-card-id=""])')).toHaveCount(3)

  // one step back takes the last card out again
  await page.getByRole('button', { name: 'Rückgängig' }).tap()
  await expect(pockets.nth(8)).toHaveAttribute('data-card-id', '')
})

test('on a phone a full page sends the next card to the following page, and a full binder says so', async ({ page }) => {
  await createBinder(page, 'Voll')
  await bar(page).getByRole('button', { name: 'Suche' }).tap()
  await page.getByRole('button', { name: 'Set', exact: true }).tap()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).tap()
  const results = page.getByTestId('search-results')
  const hint = page.getByTestId('tap-hint')
  await expect(results.getByTestId('card-tile').first()).toBeVisible()

  // nine cards fill the only page
  for (let index = 0; index < 9; index++) {
    const tile = results.getByTestId('card-tile').nth(index)
    await tile.scrollIntoViewIfNeeded()
    await tile.getByRole('button', { name: /in den Binder legen$/ }).tap()
    await expect(hint.getByRole('status')).toHaveText(new RegExp(`liegt in Seite 1 · Pocket ${index + 1}$`))
  }
  await expect(hint).toContainText('Kein freies Pocket mehr.')
  // a further tap changes nothing
  await results.getByTestId('card-tile').nth(9).getByRole('button', { name: /in den Binder legen$/ }).tap()
  await bar(page).getByRole('button', { name: 'Binder' }).tap()
  await expect(page.locator('[data-testid="pocket"]:not([data-card-id=""])')).toHaveCount(9)

  // with a new page there is room again, and that is where the next card goes
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  await bar(page).getByRole('button', { name: 'Suche' }).tap()
  await expect(hint).toContainText('Karte antippen legt sie in Seite 2 · Pocket 1')
})

test('on a phone a card is moved by tapping it, "Verschieben", and the pocket it should go to', async ({ page }) => {
  await createBinder(page, 'Umräumen')
  await bar(page).getByRole('button', { name: 'Suche' }).tap()
  await page.getByRole('button', { name: 'Set', exact: true }).tap()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).tap()
  const results = page.getByTestId('search-results')
  await results.locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: /in den Binder legen$/ }).tap()
  await expect(page.getByTestId('tap-hint').getByRole('status')).toHaveText(/Pocket 1$/)
  await bar(page).getByRole('button', { name: 'Binder' }).tap()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  await page.getByRole('button', { name: 'Zurückblättern' }).tap()
  const pockets = page.getByTestId('pocket')
  const move = page.getByRole('button', { name: 'Verschieben', exact: true })
  const hint = page.getByTestId('move-hint')

  // the button is right there in the binder once a card is tapped, not for an empty pocket
  await pockets.nth(5).tap()
  await expect(move).toHaveCount(0)
  await pockets.nth(0).tap()
  await move.tap()
  await expect(hint).toContainText('Jetzt das Ziel-Pocket antippen')

  // to the other page, which is not in view until it is turned to
  await page.getByRole('button', { name: 'Weiterblättern' }).tap()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 2')
  await expect(hint).toBeVisible()
  await pockets.nth(4).tap()
  await expect(pockets.nth(4)).toHaveAttribute('data-card-id', 'sv03.5-001')
  await expect(hint).toHaveCount(0)
  await page.getByRole('button', { name: 'Zurückblättern' }).tap()
  await expect(pockets.nth(0)).toHaveAttribute('data-card-id', '')

  // from "Auswahl" the same button leads straight back to the binder
  await page.getByRole('button', { name: 'Weiterblättern' }).tap()
  await pockets.nth(4).tap()
  await bar(page).getByRole('button', { name: 'Auswahl' }).tap()
  await page.getByTestId('column-right').getByRole('button', { name: 'Verschieben', exact: true }).tap()
  await expect(page.getByTestId('column-center')).toBeVisible()
  await expect(hint).toBeVisible()
  await pockets.nth(8).tap()
  await expect(pockets.nth(8)).toHaveAttribute('data-card-id', 'sv03.5-001')
})
