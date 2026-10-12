import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const SIGNATURE_LENGTH = 52

/** The colour index of the app, replaced by a few cards whose colours are made up. */
async function mockColours(page: Page, cards: Record<string, Record<number, number>>, rare = Object.keys(cards).length) {
  const ids = Object.keys(cards)
  const signatures = Buffer.alloc(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, position) => {
    for (const [bin, amount] of Object.entries(cards[id] ?? {})) signatures[position * SIGNATURE_LENGTH + Number(bin)] = amount
  })
  await page.route('**/colours/cards.json', (route) => route.fulfill({ json: { rare, ids } }))
  await page.route('**/colours/signatures.bin', (route) =>
    route.fulfill({ contentType: 'application/octet-stream', body: signatures }),
  )
}

/** What the image model has seen, replaced as well: two numbers per card, and the themes. */
async function mockLooks(page: Page, cards: Record<string, [number, number]>, themes: Record<string, string[]> = {}) {
  const ids = Object.keys(cards)
  const rows = Buffer.from(Int8Array.from(ids.flatMap((id) => cards[id] ?? [0, 0])).buffer)
  await page.route('**/colours/looks.json', (route) =>
    route.fulfill({ json: { size: 2, ids, themes: Object.entries(themes).map(([id, list]) => ({ id, cards: list })) } }),
  )
  await page.route('**/colours/looks.bin', (route) => route.fulfill({ contentType: 'application/octet-stream', body: rows }))
}

async function openSet151(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
}

test('the info of a card shows the cards that look most like it', async ({ page }) => {
  await mockColours(page, {
    'sv03.5-025': { 9: 255 },
    'sv03.5-001': { 0: 255 },
    'sv03.5-007': { 0: 150, 9: 105 },
    'sv03.5-004': { 0: 240, 9: 15 },
  })
  // to the model all four look the same, so the colours decide
  await mockLooks(page, { 'sv03.5-025': [50, 50], 'sv03.5-001': [50, 50], 'sv03.5-007': [50, 50], 'sv03.5-004': [50, 50] })
  await page.goto('/')
  await openSet151(page)
  const results = page.getByTestId('browse-results')

  await results.locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: 'Infos zu Bisasam' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  // nothing is loaded or shown before it is asked for
  await expect(dialog.getByTestId('similar-cards')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Ähnliche Karten' }).click()

  // the nearest first, in the language of the card, without the card itself
  const similar = dialog.getByTestId('similar-cards').getByTestId('card-tile')
  await expect(similar).toHaveCount(3)
  expect(await similar.evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-card-id')))).toEqual([
    'sv03.5-004',
    'sv03.5-007',
    'sv03.5-025',
  ])
  await expect(similar.first()).toContainText('Glumanda')
  await expect(similar.first()).toContainText('151 · 004/165')

  // a similar card is noted by its star
  await similar.first().getByRole('button', { name: 'Glumanda merken' }).click()
  await expect(similar.first().getByRole('button', { name: 'Glumanda von der Merkliste nehmen' })).toBeVisible()

  // and has an info of its own, which closes alone
  await similar.first().getByRole('button', { name: 'Infos zu Glumanda' }).click()
  const second = page.getByRole('dialog', { name: 'Glumanda' })
  await expect(second.getByTestId('card-info-rarity')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(second).toBeHidden()
  await expect(similar).toHaveCount(3)

  // pressed again, the button puts the similar cards away
  await dialog.getByRole('button', { name: 'Ähnliche Karten' }).click()
  await expect(dialog.getByTestId('similar-cards')).toHaveCount(0)
})

test('what the image model sees counts more than the colours', async ({ page }) => {
  await mockColours(page, { 'sv03.5-001': { 0: 255 }, 'sv03.5-004': { 0: 255 }, 'sv03.5-007': { 9: 255 } })
  // the card of other colours looks like the one asked about, the one of the same colours does not
  await mockLooks(page, { 'sv03.5-001': [100, 0], 'sv03.5-004': [0, 100], 'sv03.5-007': [100, 5] })
  await page.goto('/')
  await openSet151(page)

  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await dialog.getByRole('button', { name: 'Ähnliche Karten' }).click()
  const similar = dialog.getByTestId('similar-cards').getByTestId('card-tile')
  await expect(similar).toHaveCount(2)
  expect(await similar.evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-card-id')))).toEqual([
    'sv03.5-007',
    'sv03.5-004',
  ])
})

test('"Karten stöbern" offers cards by theme', async ({ page }) => {
  await mockLooks(
    page,
    { 'sv03.5-001': [1, 0] },
    { autumn: ['sv03.5-004', 'sv03.5-025'], winter: ['sv03.5-007'], unnamed: ['sv03.5-001'] },
  )
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByRole('tab', { name: 'Themen' }).click()

  // the themes that have a name, and nothing shown before one is chosen
  const themes = page.getByRole('group', { name: 'Thema' }).getByRole('button')
  await expect(themes).toHaveText(['Herbst', 'Winter'])
  await expect(page.getByTestId('theme-results')).toHaveCount(0)

  await themes.filter({ hasText: 'Herbst' }).click()
  const tiles = page.getByTestId('theme-results').getByTestId('card-tile')
  await expect(tiles).toHaveCount(2)
  await expect(tiles.first()).toContainText('Glumanda')
  await expect(tiles.nth(1)).toContainText('Pikachu')

  // a click opens the info, as everywhere on this page
  await tiles.first().getByRole('button', { name: 'Infos zu Glumanda' }).click()
  await page.getByRole('dialog', { name: 'Glumanda' }).getByRole('button', { name: 'Schließen' }).click()

  await themes.filter({ hasText: 'Winter' }).click()
  await expect(tiles).toHaveCount(1)
  await expect(tiles.first()).toContainText('Schiggy')

  // the search is still there on its tab
  await page.getByRole('tab', { name: 'Alle Karten' }).click()
  await expect(page.getByText('Namen eingeben oder ein Set wählen.').and(page.locator(':visible'))).toBeVisible()
})

test('a card whose colours are not known says so', async ({ page }) => {
  await mockColours(page, { 'sv03.5-001': { 0: 255 }, 'sv03.5-004': { 0: 240 } })
  await mockLooks(page, {})
  await page.goto('/')
  await openSet151(page)

  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-002"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Ähnliche Karten' }).click()
  await expect(dialog).toContainText('Diese Karte ist noch nicht ausgewertet.')
})
