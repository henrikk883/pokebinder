import { expect, test } from './fixtures'

const searchField = 'Name, Set oder Nummer'

test('searching for "Glurak" shows German cards with images', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Namen eingeben oder ein Set wählen.')).toBeVisible()

  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')

  const tiles = page.getByTestId('card-tile')
  await expect(tiles.first()).toBeVisible()
  await expect(tiles.filter({ hasText: 'Glurak' })).toHaveCount(await tiles.count())

  const image = tiles.locator('img').first()
  await expect(image).toHaveAttribute('src', /^https:\/\/assets\.tcgdex\.net\/de\/.+\/low\.webp$/)
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  // set name and number under the card, e.g. "151 · 006/165"
  await expect(page.locator('[data-card-id="sv03.5-006"]')).toContainText('151 · 006/165')
})

test('cards without an image appear as a grey placeholder with their name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')

  const placeholder = page.getByRole('img', { name: 'Glurak (kein Bild vorhanden)' }).first()
  await expect(placeholder).toBeVisible()
  await expect(placeholder).toHaveCSS('filter', 'grayscale(1)')
})

test('more results load on demand, and Pocket cards never show up', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')

  const tiles = page.getByTestId('card-tile')
  await expect(tiles.first()).toBeVisible()
  const firstPage = await tiles.count()

  await page.getByRole('button', { name: 'Mehr laden' }).click()
  await expect.poll(() => tiles.count()).toBeGreaterThan(firstPage)
  await expect(page.getByRole('button', { name: 'Mehr laden' })).toBeHidden()

  // A1, A2b, … are sets of the mobile game
  const ids = await tiles.evaluateAll((items) => items.map((item) => item.getAttribute('data-card-id') ?? ''))
  expect(ids.filter((id) => /^[AB]\d|^P-A/.test(id))).toEqual([])
  expect(new Set(ids).size).toBe(ids.length)
})

test('typing fast sends one search after the pause', async ({ page, tcgdex }) => {
  await page.goto('/')

  await page.getByRole('searchbox', { name: searchField }).pressSequentially('Glurak', { delay: 40 })
  await expect(page.getByTestId('card-tile').first()).toBeVisible()

  expect(tcgdex.requests.filter((request) => request.startsWith('de/cards'))).toEqual([
    'de/cards?name=Glurak&pagination:page=1&pagination:itemsPerPage=60',
  ])
})

test('sets are listed by series and a set shows all its cards in number order', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Set' }).click()
  const list = page.getByRole('listbox', { name: 'Set' })
  await expect(list.getByRole('heading', { name: 'Karmesin & Purpur' })).toBeVisible()
  await expect(list.getByRole('heading', { name: 'Schwert & Schild' })).toBeAttached()
  await expect(list.getByRole('heading', { name: /Pocket/ })).toHaveCount(0)

  // newest series first
  const headings = await list.getByRole('heading').allTextContents()
  expect(headings.indexOf('Karmesin & Purpur')).toBeLessThan(headings.indexOf('Schwert & Schild'))

  const row = list.getByRole('option', { name: /^151/ })
  await expect(row).toContainText('207')
  await expect(row.locator('img')).toHaveAttribute('src', /sv03\.5\/logo\.webp$/)
  await row.click()

  await expect(page.getByRole('button', { name: 'Set' })).toHaveText('151')
  await expect(page.getByTestId('search-results').getByRole('status')).toHaveText('151 · 207 Karten')

  const tiles = page.getByTestId('card-tile')
  await expect(tiles).toHaveCount(207)
  await expect(tiles.first()).toContainText('Bisasam')
  await expect(tiles.first()).toContainText('151 · 001/165')

  const ids = await tiles.evaluateAll((items) => items.map((item) => item.getAttribute('data-card-id') ?? ''))
  const expected = Array.from({ length: 207 }, (_, i) => `sv03.5-${String(i + 1).padStart(3, '0')}`)
  expect(ids).toEqual(expected)
})

test('the set list can be narrowed by typing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Set' }).click()

  await page.getByRole('searchbox', { name: 'Set suchen' }).fill('flammende')

  const options = page.getByRole('listbox', { name: 'Set' }).getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options).toContainText('Flammende Finsternis')
})

test('name and set filter combine', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Set' }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('card-tile')).toHaveCount(207)

  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')

  const tiles = page.getByTestId('card-tile')
  await expect(tiles).toHaveCount(3)
  await expect(tiles).toContainText(['006/165', '183/165', '199/165'])
})

test('a number alone asks for a set or a name', async ({ page, tcgdex }) => {
  await page.goto('/')

  await page.getByRole('searchbox', { name: searchField }).fill('25')

  await expect(page.getByText('Für die Suche nach einer Nummer bitte ein Set wählen')).toBeVisible()
  expect(tcgdex.requests.filter((request) => request.startsWith('de/cards'))).toEqual([])
})

test('results already seen are available without a connection', async ({ page, tcgdex }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await expect(page.getByTestId('card-tile').first()).toBeVisible()
  const online = await page.getByTestId('card-tile').count()

  tcgdex.goOffline()
  await page.reload()
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')

  await expect(page.getByTestId('card-tile')).toHaveCount(online)
  await page.getByRole('button', { name: 'Set' }).click()
  await expect(page.getByRole('heading', { name: 'Karmesin & Purpur' })).toBeVisible()
})

test('a search that cannot be loaded says so', async ({ page, tcgdex }) => {
  await page.goto('/')
  await expect(page.getByText('Namen eingeben oder ein Set wählen.')).toBeVisible()
  tcgdex.goOffline()

  await page.getByRole('searchbox', { name: searchField }).fill('Pikachu')

  await expect(page.getByRole('alert')).toContainText('Die Karten konnten nicht geladen werden.')
})
