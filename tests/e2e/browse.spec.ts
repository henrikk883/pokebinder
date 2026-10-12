import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const header = (page: Page) => page.getByRole('banner')
const results = (page: Page) => page.getByTestId('browse-results')

async function openSet151(page: Page) {
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(results(page).getByTestId('card-tile').first()).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the page "Karten" shows the search over the whole width, many cards side by side', async ({ page }) => {
  await header(page).getByRole('button', { name: 'Karten' }).click()
  await expect(page.getByRole('heading', { name: 'Karten stöbern', exact: true })).toBeVisible()
  // the three columns make room for it
  await expect(page.getByTestId('column-left')).toBeHidden()
  await expect(page.getByTestId('column-right')).toBeHidden()
  await expect(page.getByText('Namen eingeben oder ein Set wählen.').and(page.locator(':visible'))).toBeVisible()

  await openSet151(page)
  const tiles = results(page).getByTestId('card-tile')
  await expect(tiles).toHaveCount(207)
  // far more than the two of the narrow search fit into a row
  const first = await tiles.first().boundingBox()
  const tops = await tiles.evaluateAll((entries) => entries.slice(0, 12).map((entry) => entry.getBoundingClientRect().top))
  const perRow = tops.filter((top) => Math.abs(top - (first?.y ?? 0)) < 1).length
  expect(perRow).toBeGreaterThanOrEqual(6)
  expect(first?.width).toBeGreaterThan(160)
  // no page scrolls sideways
  expect(await page.getByTestId('page').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true)

  // name and set under each card, as in the narrow search
  await expect(tiles.first()).toContainText('Bisasam')
  await expect(tiles.first()).toContainText('151 · 001/165')
})

test('on the page "Karten" a click opens the info and the star notes the card', async ({ page }) => {
  await header(page).getByRole('button', { name: 'Karten' }).click()
  await openSet151(page)
  const tile = results(page).locator('[data-card-id="sv03.5-001"]')

  // a click on the card: its info
  await tile.getByRole('button', { name: 'Infos zu Bisasam' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await expect(dialog.getByTestId('card-info-languages')).toHaveText('Deutsch, Englisch')
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await expect(dialog).toBeHidden()

  // the star shows under the mouse and notes the card without opening anything
  const star = tile.getByRole('button', { name: 'Bisasam merken' })
  await page.mouse.move(5, 5)
  await expect(star).toHaveCSS('opacity', '0')
  await tile.hover()
  await expect(star).toHaveCSS('opacity', '1')
  await star.click()
  await expect(dialog).toBeHidden()
  const noted = tile.getByRole('button', { name: 'Bisasam von der Merkliste nehmen' })
  await expect(noted).toHaveAttribute('aria-pressed', 'true')
  // a noted card keeps its star in view
  await page.mouse.move(5, 5)
  await expect(noted).toHaveCSS('opacity', '1')

  // a second card, then the list in large
  const second = results(page).locator('[data-card-id="sv03.5-002"]')
  await second.hover()
  await second.getByRole('button', { name: /merken$/ }).click()
  const savedTab = page.getByTestId('page').getByRole('tab', { name: /^Merkliste/ })
  await expect(savedTab).toContainText('2')
  await savedTab.click()
  const list = page.getByTestId('browse-watchlist')
  await expect(list).toContainText('2 Karten gemerkt')
  await expect(list.getByTestId('card-tile')).toHaveCount(2)

  // the list is chosen here as beside the binder
  await expect(page.getByTestId('page').getByRole('combobox', { name: 'Merkliste' }).locator('option')).toHaveText([
    'Schnellmerken (2)',
  ])

  // taken off the list with the same star
  await list.locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: 'Bisasam von der Merkliste nehmen' }).click()
  await expect(list.getByTestId('card-tile')).toHaveCount(1)

  // the search is as it was left
  await page.getByTestId('page').getByRole('tab', { name: 'Alle Karten' }).click()
  await expect(results(page).getByTestId('card-tile')).toHaveCount(207)
  await expect(tile.getByRole('button', { name: 'Bisasam merken' })).toHaveAttribute('aria-pressed', 'false')
})

test('what is noted on the page "Karten" waits beside the binder; the binder stays open underneath', async ({ page }) => {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Planung')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: 'Planung' })).toBeVisible()
  // the search beside the binder keeps what was typed
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')

  await header(page).getByRole('button', { name: 'Karten' }).click()
  await expect(page.getByRole('heading', { name: 'Planung' })).toBeHidden()
  await openSet151(page)
  const tile = results(page).locator('[data-card-id="sv03.5-001"]')
  await tile.hover()
  await tile.getByRole('button', { name: 'Bisasam merken' }).click()

  // back to the binder by its name in the header
  await header(page).getByRole('button', { name: 'Planung' }).click()
  await expect(page.getByRole('heading', { name: 'Planung' })).toBeVisible()
  await expect(page.getByTestId('page')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Name, Set oder Nummer' })).toHaveValue('Glurak')

  // the noted card is on the list there and goes into a pocket
  await page.getByTestId('column-left').getByRole('tab', { name: /^Merkliste/ }).click()
  const noted = page.getByTestId('watchlist').locator('[data-card-id="sv03.5-001"]')
  const from = await noted.locator('img').boundingBox()
  const to = await page.getByTestId('pocket').first().boundingBox()
  if (!from || !to) throw new Error('Card or pocket is not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId('pocket').first()).toHaveAttribute('data-card-id', 'sv03.5-001')

  // "Meine Binder" leads to the shelf, from the page "Karten" as well
  await header(page).getByRole('button', { name: 'Karten' }).click()
  await header(page).getByRole('button', { name: 'Meine Binder' }).click()
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Planung öffnen' })).toBeVisible()

  // opening a binder from there shows the binder
  await header(page).getByRole('button', { name: 'Karten' }).click()
  await header(page).getByRole('button', { name: 'Meine Binder' }).click()
  await page.getByRole('button', { name: 'Planung öffnen' }).click()
  await expect(page.getByRole('heading', { name: 'Planung' })).toBeVisible()
})
