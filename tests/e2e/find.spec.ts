import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const pocket = (page: Page, pageNumber: number, position: number) =>
  page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .nth(position - 1)

async function createMasterSet(page: Page) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByText('Master Set', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Set', exact: true }).click()
  await dialog.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(dialog.getByTestId('master-set-summary')).toBeVisible()
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: '151', exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('a card is found in the binder by name or number; choosing it turns to its page and selects its pocket', async ({
  page,
}) => {
  await createMasterSet(page)
  await page.getByRole('button', { name: 'Karte im Binder finden' }).click()
  const find = page.getByRole('dialog', { name: 'Karte im Binder finden' })
  const field = find.getByRole('searchbox', { name: 'Name oder Nummer' })
  const hits = find.getByTestId('find-hit')

  // by name: every place the Pokémon lies in, in the order of the binder
  await field.fill('bisasam')
  await expect(hits).toHaveText(['Bisasam · 001Seite 1 · Pocket 1', 'Bisasam · 166Seite 19 · Pocket 4'])
  await field.fill('gibt es nicht')
  await expect(find).toContainText('Keine passende Karte.')

  // by number, as printed on the card: card 150 of "151" lies in the sixth pocket of page 17
  await field.fill('150/165')
  await expect(hits).toHaveCount(1)
  await expect(hits).toContainText('Seite 17 · Pocket 6')
  await hits.click()

  await expect(find).toHaveCount(0)
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 16 – 17')
  await expect(pocket(page, 17, 6)).toHaveAttribute('aria-pressed', 'true')
  await expect(pocket(page, 17, 6)).toHaveAttribute('data-card-id', 'sv03.5-150')

  // Enter takes the first hit
  await page.getByRole('button', { name: 'Karte im Binder finden' }).click()
  await page.getByRole('searchbox', { name: 'Name oder Nummer' }).fill('1')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 1')
  await expect(pocket(page, 1, 1)).toHaveAttribute('aria-pressed', 'true')
})

test('the cards shown in a deck are narrowed down by name or number', async ({ page }) => {
  await page.getByTestId('deck-shelf').getByRole('button', { name: 'Neues Deck' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Deck' })
  await dialog.getByLabel('Name').fill('Pflanze')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Set', exact: true }).click()
  await main.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  for (const cardId of ['sv03.5-001', 'sv03.5-002', 'sv03.5-003']) {
    await page.getByTestId('pick-results').locator(`[data-card-id="${cardId}"]`).getByRole('button', { name: /ins Deck legen$/ }).click()
  }
  await page.getByRole('tab', { name: /^Deck/ }).click()
  const cards = () =>
    page.getByTestId('deck-card').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-card-id')))
  await expect.poll(cards).toEqual(['sv03.5-001', 'sv03.5-002', 'sv03.5-003'])

  const filter = page.getByRole('searchbox', { name: /^Im Deck suchen/ })
  await filter.fill('bisakn')
  await expect.poll(cards).toEqual(['sv03.5-002'])
  await filter.fill('3')
  await expect.poll(cards).toEqual(['sv03.5-003'])
  await filter.fill('glurak')
  await expect(page.getByTestId('deck-cards')).toContainText('Keine passende Karte.')
  // the deck itself is untouched by looking through it
  await expect(page.getByTestId('deck-check')).toContainText('3 / 60 Karten')
  await filter.fill('')
  await expect.poll(cards).toEqual(['sv03.5-001', 'sv03.5-002', 'sv03.5-003'])
})
