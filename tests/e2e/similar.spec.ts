import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const SIGNATURE_LENGTH = 52

/** The colour index of the app, replaced by a few cards whose colours are made up. */
async function mockColours(page: Page, cards: Record<string, Record<number, number>>) {
  const ids = Object.keys(cards)
  const signatures = Buffer.alloc(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, position) => {
    for (const [bin, amount] of Object.entries(cards[id] ?? {})) signatures[position * SIGNATURE_LENGTH + Number(bin)] = amount
  })
  await page.route('**/colours/cards.json', (route) => route.fulfill({ json: ids }))
  await page.route('**/colours/signatures.bin', (route) =>
    route.fulfill({ contentType: 'application/octet-stream', body: signatures }),
  )
}

async function openSet151(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
}

test('the info of a card shows the cards whose pictures have the most similar colours', async ({ page }) => {
  await mockColours(page, {
    'sv03.5-025': { 9: 255 },
    'sv03.5-001': { 0: 255 },
    'sv03.5-007': { 0: 150, 9: 105 },
    'sv03.5-004': { 0: 240, 9: 15 },
  })
  await page.goto('/')
  await openSet151(page)
  const results = page.getByTestId('browse-results')

  await results.locator('[data-card-id="sv03.5-001"]').getByRole('button', { name: 'Infos zu Bisasam' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  // nothing is loaded or shown before it is asked for
  await expect(dialog.getByTestId('similar-cards')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Ähnliche Farben' }).click()

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
  await dialog.getByRole('button', { name: 'Ähnliche Farben' }).click()
  await expect(dialog.getByTestId('similar-cards')).toHaveCount(0)
})

test('a card whose colours are not known says so', async ({ page }) => {
  await mockColours(page, { 'sv03.5-001': { 0: 255 }, 'sv03.5-004': { 0: 240 } })
  await page.goto('/')
  await openSet151(page)

  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-002"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Ähnliche Farben' }).click()
  await expect(dialog).toContainText('Für diese Karte sind die Farben noch nicht ausgewertet.')
})
