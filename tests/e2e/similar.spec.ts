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

test('more similar cards are shown when asked for', async ({ page }) => {
  // thirty cards of the same colours as the one asked about
  const cards = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [`sv03.5-${String(index + 1).padStart(3, '0')}`, { 0: 255 }]),
  )
  await mockColours(page, cards)
  await mockLooks(page, {})
  await page.goto('/')
  await openSet151(page)

  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await dialog.getByRole('button', { name: 'Ähnliche Karten' }).click()
  const similar = dialog.getByTestId('similar-cards').getByTestId('card-tile')
  await expect(similar).toHaveCount(24)
  await dialog.getByRole('button', { name: 'Mehr anzeigen' }).click()
  await expect(similar).toHaveCount(30)
  await expect(dialog.getByRole('button', { name: 'Mehr anzeigen' })).toHaveCount(0)
})

test('"Karten stöbern" offers cards by theme and by the colour of their pictures', async ({ page }) => {
  // fifty cards of the set, from number 51 on
  const many = Array.from({ length: 50 }, (_, index) => `sv03.5-${String(index + 51).padStart(3, '0')}`)
  await mockLooks(
    page,
    { 'sv03.5-001': [1, 0] },
    { autumn: ['sv03.5-004', 'sv03.5-025'], winter: ['sv03.5-007'], spring: many, unnamed: ['sv03.5-001'] },
  )
  // Pikachu's picture is red, Glumanda's blue, Schiggy's and Bisasam's orange
  await mockColours(page, {
    'sv03.5-004': { 32: 255 },
    'sv03.5-025': { 0: 255 },
    'sv03.5-007': { 4: 255 },
    'sv03.5-001': { 4: 200, 32: 55 },
  })
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByRole('tab', { name: 'Themen' }).click()

  // the themes that have a name, the colours, and nothing shown before one is chosen
  const theme = page.getByRole('combobox', { name: 'Thema' })
  const colour = page.getByRole('combobox', { name: 'Farbe' })
  await expect(theme.locator('option')).toHaveText(['Alle Themen', 'Herbst', 'Winter', 'Frühling'])
  await expect(colour.locator('option')).toHaveText([
    'Alle Farben',
    'Rot',
    'Orange',
    'Gelb',
    'Grün',
    'Türkis',
    'Blau',
    'Violett',
    'Pink',
    'Schwarz',
    'Weiß',
  ])
  await expect(page.getByTestId('theme-results')).toHaveCount(0)
  await expect(page.getByText('Thema oder Farbe wählen.')).toBeVisible()

  await theme.selectOption('Herbst')
  const tiles = page.getByTestId('theme-results').getByTestId('card-tile')
  await expect(tiles).toHaveCount(2)
  await expect(tiles.first()).toContainText('Glumanda')
  await expect(tiles.nth(1)).toContainText('Pikachu')

  // a click opens the info, as everywhere on this page
  await tiles.first().getByRole('button', { name: 'Infos zu Glumanda' }).click()
  await page.getByRole('dialog', { name: 'Glumanda' }).getByRole('button', { name: 'Schließen' }).click()

  // the same cards in the order of the colour wheel: red before blue
  const order = page.getByRole('combobox', { name: 'Reihenfolge' })
  await order.selectOption('Nach Farbe')
  await expect(tiles.first()).toContainText('Pikachu')
  await expect(tiles.nth(1)).toContainText('Glumanda')
  await order.selectOption('Passendste zuerst')
  await expect(tiles.first()).toContainText('Glumanda')

  // a theme and a colour together: the cards of the theme that are of that colour
  await colour.selectOption('Rot')
  await expect(tiles).toHaveCount(1)
  await expect(tiles.first()).toContainText('Pikachu')
  await colour.selectOption('Orange')
  await expect(page.getByTestId('theme-results')).toContainText('Zu dieser Auswahl gibt es keine Karten.')

  // a colour alone: the cards with the most of it first, whatever their theme
  await theme.selectOption('Alle Themen')
  await expect(tiles).toHaveCount(2)
  await expect(tiles.first()).toContainText('Schiggy')
  await expect(tiles.nth(1)).toContainText('Bisasam')
  await colour.selectOption('Alle Farben')
  await expect(page.getByTestId('theme-results')).toHaveCount(0)

  await theme.selectOption('Winter')
  await expect(tiles).toHaveCount(1)
  await expect(tiles.first()).toContainText('Schiggy')
  await expect(page.getByRole('button', { name: 'Mehr anzeigen' })).toHaveCount(0)

  // a theme with many cards shows the best ones first and the others when asked
  await theme.selectOption('Frühling')
  await expect(tiles).toHaveCount(48)
  await page.getByRole('button', { name: 'Mehr anzeigen' }).click()
  await expect(tiles).toHaveCount(50)
  await expect(page.getByRole('button', { name: 'Mehr anzeigen' })).toHaveCount(0)

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
