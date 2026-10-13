import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { makePng, pngFile } from './png'

const shelf = (page: Page) => page.getByTestId('deck-shelf')
const check = (page: Page) => page.getByTestId('deck-check')
const inDeck = (page: Page) =>
  page
    .getByTestId('deck-card')
    .evaluateAll((cards) => cards.map((card) => `${card.getAttribute('data-card-id')}×${card.getAttribute('data-count')}`))

async function createDeck(page: Page, name: string) {
  await shelf(page).getByRole('button', { name: 'Neues Deck' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Deck' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
}

/** Shows the cards of "151" in the search of the open deck. */
async function showSet151(page: Page) {
  const picker = page.getByRole('main')
  await picker.getByRole('button', { name: 'Set', exact: true }).click()
  await picker.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('pick-results').getByTestId('card-tile').first()).toBeVisible()
}

const pick = (page: Page, cardId: string) =>
  page.getByTestId('pick-results').locator(`[data-card-id="${cardId}"]`).getByRole('button', { name: /ins Deck legen$/ })

async function toShelf(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the shelf has a second row for decks, each in its box', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Binder', exact: true })).toBeVisible()
  await expect(shelf(page).getByRole('heading', { name: 'Decks' })).toBeVisible()
  await expect(shelf(page)).toContainText('Noch kein Deck angelegt.')

  await createDeck(page, 'Donner')
  // the open deck is named in the header, like an open binder
  await expect(page.getByRole('banner')).toContainText('Donner')
  await toShelf(page)

  const tile = page.getByTestId('deck-tile')
  await expect(tile).toHaveCount(1)
  await expect(tile.getByTestId('deck-box')).toContainText('Donner')
  await expect(tile.getByTestId('deck-box')).toContainText('0 / 60 Karten')
  // a deck is no binder
  await expect(page.getByTestId('binder-tile')).toHaveCount(0)
})

test('cards are put into a deck by clicking them in the search; the deck shows them by kind with their number', async ({
  page,
}) => {
  await createDeck(page, 'Donner')
  // an empty deck opens where cards are found
  await expect(page.getByRole('tab', { name: 'Karten hinzufügen' })).toHaveAttribute('aria-selected', 'true')
  await showSet151(page)

  await pick(page, 'sv03.5-001').click()
  await pick(page, 'sv03.5-001').click()
  await pick(page, 'sv03.5-002').click()
  // a card whose kind the recorded answers do not tell: it is listed apart until that is known
  await pick(page, 'sv03.5-196').click()
  await expect(page.getByTestId('pick-results').locator('[data-card-id="sv03.5-001"]').getByTestId('picked-count')).toHaveText('×2')
  await expect(check(page)).toHaveText('4 / 60 Karten · es fehlen noch 56 Karten')

  await page.getByRole('tab', { name: /^Deck/ }).click()
  const groups = page.getByTestId('deck-group')
  await expect(groups).toHaveCount(2)
  await expect(groups.nth(0).getByRole('heading')).toHaveText('Pokémon 3')
  await expect(groups.nth(1).getByRole('heading')).toHaveText('Weitere Karten 1')
  expect(await inDeck(page)).toEqual(['sv03.5-001×2', 'sv03.5-002×1', 'sv03.5-196×1'])

  // one more, one fewer, and out with the last copy
  await page.getByRole('button', { name: 'Bisasam: eine mehr' }).click()
  await page.getByRole('button', { name: 'Bisaknosp: eine weniger' }).click()
  await expect.poll(() => inDeck(page)).toEqual(['sv03.5-001×3', 'sv03.5-196×1'])
  await expect(check(page)).toHaveText('4 / 60 Karten · es fehlen noch 56 Karten')

  // the deck is stored: it is there again after the page is loaded anew
  await page.reload()
  await expect(shelf(page).getByTestId('deck-box')).toContainText('4 / 60 Karten')
  await page.getByRole('button', { name: 'Deck Donner öffnen' }).click()
  // a deck with cards opens on its cards
  await expect(page.getByRole('tab', { name: /^Deck/ })).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => inDeck(page)).toEqual(['sv03.5-001×3', 'sv03.5-196×1'])
})

test('more than four cards of one name are pointed out', async ({ page }) => {
  await createDeck(page, 'Zu viele')
  await showSet151(page)
  for (let copies = 0; copies < 4; copies++) await pick(page, 'sv03.5-001').click()
  await expect(page.getByTestId('deck-too-many')).toHaveCount(0)

  // the fifth Bisasam is another print of it: the name counts, not the card
  await pick(page, 'sv03.5-166').click()

  await expect(page.getByTestId('deck-too-many')).toHaveText(
    'Höchstens 4 Karten mit gleichem Namen (außer Basis-Energie): Bisasam (5)',
  )
  // a broken rule stands out: in red, with a sign of warning
  await expect(page.getByTestId('deck-too-many')).toHaveCSS('color', 'rgb(239, 68, 68)')
  await expect(page.getByTestId('deck-too-many').locator('svg')).toBeVisible()
  await expect(page.getByTestId('deck-too-many')).toHaveAttribute('role', 'alert')
  await expect(check(page)).toHaveAttribute('data-valid', 'false')
})

test('a deck is renamed and deleted on the shelf, and its box can carry a picture', async ({ page }) => {
  await createDeck(page, 'Alt')
  await page.getByLabel('Bild für die Deckbox wählen').setInputFiles(pngFile('box.png', makePng(300, 400, [230, 90, 30])))
  await expect(page.getByRole('button', { name: 'Bild der Deckbox ändern' })).toBeVisible()
  await toShelf(page)
  const picture = page.getByTestId('deck-box-image')
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Deck Alt umbenennen' }).click()
  const rename = page.getByRole('dialog', { name: 'Deck umbenennen' })
  await rename.getByLabel('Name').fill('Neu')
  await rename.getByRole('button', { name: 'Umbenennen' }).click()
  await expect(page.getByTestId('deck-tile')).toHaveAttribute('data-deck-name', 'Neu')

  await page.getByRole('button', { name: 'Deck Neu löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(page.getByTestId('deck-tile')).toHaveCount(0)
})

test('the format says which cards are allowed; the deck says what it costs and what of it lies in the binders', async ({
  page,
}) => {
  // a binder of "151" in which Bisasam is there
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
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()
  await toShelf(page)

  await createDeck(page, 'Pflanze')
  await showSet151(page)
  await pick(page, 'sv03.5-001').click()
  await pick(page, 'sv03.5-001').click()
  await pick(page, 'sv03.5-002').click()

  // "151" is no longer part of Standard
  await expect(page.getByRole('combobox', { name: 'Format' })).toHaveValue('standard')
  await expect(page.getByTestId('deck-not-allowed')).toHaveText('In Standard nicht erlaubt: Bisasam (2), Bisaknosp (1)')
  await expect(page.getByTestId('deck-worth')).toHaveText(
    /^Wert: [0-9.,]+ € · 1 Karte liegt in deinen Bindern, 2 fehlen noch [(][0-9.,]+ €[)]$/,
  )
  await page.getByRole('tab', { name: /^Deck/ }).click()
  const bisasam = page.locator('[data-testid="deck-card"][data-card-id="sv03.5-001"]')
  await expect(bisasam).toHaveAttribute('data-allowed', 'false')
  await expect(bisasam).toContainText('Nicht erlaubt')
  await expect(bisasam.getByTestId('deck-card-owned')).toHaveText('1 von 2 im Binder')
  await expect(check(page)).toHaveAttribute('data-valid', 'false')

  await page.getByRole('combobox', { name: 'Format' }).selectOption('expanded')
  await expect(page.getByTestId('deck-not-allowed')).toHaveCount(0)
  await expect(bisasam).toHaveAttribute('data-allowed', 'true')

  // the format is part of the deck: the shelf names it
  await toShelf(page)
  await expect(page.getByTestId('deck-tile')).toContainText('Expanded · 2 verschiedene Karten')
})

test('"Alles sichern" holds the decks; from the file they come back', async ({ page }) => {
  await createDeck(page, 'Sicher')
  await showSet151(page)
  await pick(page, 'sv03.5-001').click()
  await pick(page, 'sv03.5-001').click()
  await toShelf(page)
  await expect(page.getByTestId('deck-box')).toContainText('2 / 60 Karten')

  await page.getByRole('button', { name: 'Backup', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /^Alles sichern/ }).click()
  const file = await (await downloading).path()
  const backup = JSON.parse(await readFile(file, 'utf8')) as { decks?: { name: string; cards: { cardId: string; count: number }[] }[] }
  expect(backup.decks).toMatchObject([{ name: 'Sicher', cards: [{ cardId: 'sv03.5-001', count: 2 }] }])

  // gone from the device, and back from the file
  await page.getByRole('button', { name: 'Deck Sicher löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(page.getByTestId('deck-tile')).toHaveCount(0)

  await page.getByLabel('Backup-Datei auswählen').setInputFiles(file)
  await expect(page.getByTestId('deck-tile')).toHaveAttribute('data-deck-name', 'Sicher')
  await expect(page.getByTestId('deck-box')).toContainText('2 / 60 Karten')
})
