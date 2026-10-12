import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from './fixtures'

const searchField = 'Name, Set oder Nummer'

function pocket(page: Page, pageNumber: number, position: number): Locator {
  return page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .nth(position - 1)
}

async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded()
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Drag source or target is not visible')
  const x = start.x + start.width / 2
  const y = start.y + start.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 12, y + 12, { steps: 3 })
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 })
  await page.mouse.up()
}

async function createBinder(page: Page, name: string, lang?: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  if (lang) await dialog.getByLabel('Sprache der Karten').selectOption(lang)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

/** The language of the card search in the left column. */
const searchLanguage = (page: Page) => page.getByTestId('column-left').getByLabel('Sprache der Karten')
const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('an English card is found, placed, kept after a reload and can be switched to German', async ({ page }) => {
  await createBinder(page, 'Gemischt')
  await expect(searchLanguage(page)).toHaveValue('de')
  await expect(searchLanguage(page).locator('option')).toHaveText(['Deutsch', 'Englisch', 'Japanisch'])

  await searchLanguage(page).selectOption('en')
  await page.getByRole('searchbox', { name: searchField }).fill('Charizard')
  const tile = page.locator('[data-testid="card-tile"][data-card-id="sv03.5-006"]')
  await expect(tile).toContainText('Charizard ex')
  await expect(tile.locator('img')).toHaveAttribute('src', /assets\.tcgdex\.net\/en\/sv\/sv03\.5\/006\/low\.webp$/)

  await drag(page, tile.locator('img'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'en')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Charizard ex' })).toHaveAttribute(
    'src',
    /\/en\/sv\/sv03\.5\/006\/high\.webp$/,
  )
  await saved(page)

  await page.reload()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'en')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Charizard ex' })).toBeVisible()
  // the search starts in the language of the binder again
  await expect(searchLanguage(page)).toHaveValue('de')

  // the same card exists in German and English, but not in Japanese
  await pocket(page, 1, 1).click()
  const cardLanguage = page.getByLabel('Sprache der Karte', { exact: true })
  await expect(cardLanguage).toHaveValue('en')
  await expect(cardLanguage.locator('option')).toHaveText(['Deutsch', 'Englisch'])
  await expect(page.getByTestId('selected-rarity')).toHaveText('Double rare')

  await cardLanguage.selectOption('de')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'de')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Glurak-ex' })).toHaveAttribute(
    'src',
    /\/de\/sv\/sv03\.5\/006\/high\.webp$/,
  )
  await expect(page.getByTestId('selected-rarity')).toHaveText('Doppelselten')
  await expect(page.getByTestId('column-right')).toContainText('151 · 006/165')
})

test('German and English cards lie side by side in one binder', async ({ page }) => {
  await createBinder(page, 'Zwei Sprachen')
  // the same card id in both languages: only the search tile is meant, not the card in the binder
  const tile = page.locator('[data-testid="card-tile"][data-card-id="sv03.5-006"]')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await expect(tile).toContainText('Glurak-ex')
  await drag(page, tile.locator('img'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'de')

  await searchLanguage(page).selectOption('en')
  // another language starts the search afresh
  await expect(page.getByRole('searchbox', { name: searchField })).toHaveValue('')
  await page.getByRole('searchbox', { name: searchField }).fill('Charizard')
  await expect(tile).toContainText('Charizard ex')
  await drag(page, tile.locator('img'), pocket(page, 1, 2))

  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Glurak-ex' })).toBeVisible()
  await expect(pocket(page, 1, 2).getByRole('img', { name: 'Charizard ex' })).toBeVisible()
  await expect(pocket(page, 1, 2)).toHaveAttribute('data-lang', 'en')
})

test('changing the search language resets the filters and offers that language\'s sets', async ({ page }) => {
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('card-tile')).toHaveCount(207)
  await expect(page.getByTestId('card-tile').first()).toContainText('Bisasam')
  await expect(page.getByLabel('Typ').locator('option').nth(1)).toHaveText('Drache')

  await searchLanguage(page).selectOption('en')

  await expect(page.getByRole('button', { name: 'Set', exact: true })).toHaveText('Alle Sets')
  await expect(page.getByTestId('card-tile')).toHaveCount(0)
  await expect(page.getByLabel('Typ').locator('option').nth(1)).toHaveText('Colorless')
  await expect(page.getByLabel('Seltenheit').locator('option', { hasText: 'Double rare' })).toHaveCount(1)
  // the Pocket rarities stay hidden in English as well
  await expect(page.getByLabel('Seltenheit').locator('option', { hasText: 'One Diamond' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Set', exact: true }).click()
  const list = page.getByRole('listbox', { name: 'Set' })
  await expect(list.getByRole('heading', { name: 'Scarlet & Violet' })).toBeVisible()
  await expect(list.getByRole('heading', { name: /Pocket/ })).toHaveCount(0)
  await list.getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('card-tile')).toHaveCount(207)
  await expect(page.getByTestId('card-tile').first()).toContainText('Bulbasaur')
})

test('an English binder builds its master set in English', async ({ page }) => {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Sprache der Karten').selectOption('en')
  await dialog.getByText('Master Set', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Set', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Scarlet & Violet' })).toBeVisible()
  await dialog.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 207 Karten auf 23 Seiten.')
  // rarities carry their English names
  await expect(dialog.getByRole('group', { name: 'Secret Rares' })).toContainText('Illustration rare (16)')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()

  await expect(page.getByRole('heading', { name: '151', exact: true })).toBeVisible()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'en')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Bulbasaur' })).toHaveAttribute('src', /\/en\/sv\/sv03\.5\/001\//)
  await expect(page.getByTestId('pocket').and(page.locator('[data-lang="en"]'))).toHaveCount(9)
  // the search follows the language of the binder
  await expect(searchLanguage(page)).toHaveValue('en')

  // and the master set can still be adjusted in that language
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Master Set anpassen' }).click()
  const settings = page.getByRole('dialog', { name: 'Master Set anpassen' })
  await settings.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  await expect(settings.getByTestId('master-set-summary')).toContainText('360 Karten')
  await settings.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(pocket(page, 1, 2)).toHaveAttribute('data-variant', 'reverse')
  await expect(pocket(page, 1, 2)).toHaveAttribute('data-lang', 'en')
})

test('Japanese cards come from the Japanese sets and stay Japanese', async ({ page }) => {
  await createBinder(page, 'Japan', 'ja')
  await expect(searchLanguage(page)).toHaveValue('ja')

  await page.getByRole('searchbox', { name: searchField }).fill('リザードン')
  await expect(page.locator('[data-testid="card-tile"][data-card-id="SV2a-006"]')).toContainText('リザードンex')

  // Japanese sets are cut differently: "151" is the set SV2a there
  await page.getByRole('searchbox', { name: searchField }).fill('')
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Set suchen' }).fill('SV2a')
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option').click()
  await expect(page.getByTestId('card-tile')).toHaveCount(210)
  const first = page.getByTestId('card-tile').first()
  await expect(first).toContainText('フシギダネ')
  await expect(first.locator('img')).toHaveAttribute('src', /assets\.tcgdex\.net\/ja\/SV\/SV2a\/001\/low\.webp$/)

  await drag(page, first.locator('img'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'SV2a-001')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'ja')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'フシギダネ' })).toBeVisible()

  // there is no German or English card with this id, so the language is fixed
  const cardLanguage = page.getByLabel('Sprache der Karte', { exact: true })
  await expect(cardLanguage).toHaveValue('ja')
  await expect(cardLanguage.locator('option')).toHaveText(['Japanisch'])
  await expect(cardLanguage).toBeDisabled()
  // in Japan every card of the set has both ball patterns
  await expect(page.getByLabel('Variante').locator('option')).toHaveText(['Normal', 'Meisterball', 'Pokéball'])

  await saved(page)
  await page.reload()
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'フシギダネ' })).toBeVisible()
  await expect(searchLanguage(page)).toHaveValue('ja')
})

test('the checklist prints Japanese names; the font for them is only loaded for such lists', async ({ page }) => {
  const fontRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/fonts/')) fontRequests.push(request.url())
  })
  const checklist = async () => {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Was fehlt?', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Als PDF' }).click()
    return readFile(await (await download).path())
  }
  const placeFirstAsMissing = async (search: string) => {
    await page.getByRole('searchbox', { name: searchField }).fill(search)
    const tile = page.getByTestId('card-tile').first()
    await expect(tile).toBeVisible()
    await drag(page, tile.locator('img'), pocket(page, 1, 1))
    await expect(pocket(page, 1, 1)).not.toHaveAttribute('data-card-id', '')
    await pocket(page, 1, 1).hover()
    await pocket(page, 1, 1).getByRole('button', { name: 'Als fehlend markieren' }).click()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'false')
  }

  // a German list is written with the standard font: small, and no font is fetched
  await createBinder(page, 'Deutsch')
  await placeFirstAsMissing('Glurak')
  const german = await checklist()
  expect(german.length).toBeLessThan(200_000)
  expect(fontRequests).toEqual([])

  // A Japanese one carries the font that can write its names. (The recorded TCGdex answers
  // hold no details of single Japanese cards, so here it is the binder's name that needs it.)
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  await createBinder(page, '日本のバインダー', 'ja')
  await placeFirstAsMissing('リザードン')
  const japanese = await checklist()
  expect(japanese.length).toBeGreaterThan(1_000_000)
  expect(fontRequests).toHaveLength(1)
  const pdf = await PDFDocument.load(japanese)
  expect(pdf.getForm().getFields()).toHaveLength(1)

  // the font is kept for the next list
  await checklist()
  expect(fontRequests).toHaveLength(1)
})
