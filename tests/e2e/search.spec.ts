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

test('cards without any image appear as a grey placeholder with their name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await page.getByRole('button', { name: 'Mehr laden' }).click()
  await expect(page.getByRole('button', { name: 'Mehr laden' })).toBeHidden()

  // images load only once they scroll into view, and only then it shows that one is missing
  for (const tile of await page.getByTestId('card-tile').all()) await tile.scrollIntoViewIfNeeded()

  const placeholder = page.getByRole('img', { name: 'Glurak (kein Bild vorhanden)' }).first()
  await expect(placeholder).toBeVisible()
  await expect(placeholder).toContainText('Glurak')
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

test('a number as printed on the card finds that card', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('searchbox', { name: searchField }).fill('006/165')

  // 151 and Expedition both have 165 official cards
  const tiles = page.getByTestId('card-tile')
  await expect(page.locator('[data-card-id="sv03.5-006"]')).toContainText('Glurak-ex')
  await expect(tiles).toHaveCount(2)
  await expect(tiles).toContainText(['006/165', '6/165'])
})

test('a card without a German scan shows the English one, in colour', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await page.getByRole('button', { name: 'Mehr laden' }).click()

  const substitute = page.getByRole('img', { name: 'Glurak (englisches Bild)' }).first()
  await expect(substitute).toHaveAttribute('src', /^https:\/\/assets\.tcgdex\.net\/en\/.+\/low\.webp$/)
  // black and white is reserved for cards marked as missing in the binder
  await expect(substitute).toHaveCSS('filter', 'none')
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

test('the info button on a card opens a closer look: picture, languages, finishes with prices, rarity', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Vorschau')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  // the first card of the set "151"
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const tile = page.locator('[data-testid="card-tile"][data-card-id="sv03.5-001"]')
  await expect(tile).toBeVisible()
  const info = tile.getByRole('button', { name: 'Infos zu Bisasam' })
  // under the mouse the button shows on the card pointed at
  await expect(info).toHaveCSS('opacity', '0')
  await tile.hover()
  await expect(info).toHaveCSS('opacity', '1')

  await info.click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await expect(dialog).toContainText('151 · 001/165')
  // the large scan, as in the binder
  await expect(dialog.getByRole('img', { name: 'Bisasam' })).toHaveAttribute('src', /\/de\/sv\/sv03\.5\/001\/high\.webp$/)
  await expect(dialog.getByTestId('card-info-languages')).toHaveText('Deutsch, Englisch')
  await expect(dialog.getByTestId('card-info-rarity')).not.toHaveText('')
  // every finish the card exists in, each with what it costs
  const variants = dialog.getByTestId('card-info-variant')
  await expect(variants.filter({ hasText: 'Normal' })).toHaveText(/Normal\d+,\d{2} €$/)
  await expect(variants.filter({ hasText: 'Reverse' })).toHaveText(/Reverse.*\d+,\d{2} €$/)
  // looking does not put the card into the binder
  await expect(page.locator('[data-testid="pocket"]:not([data-card-id=""])')).toHaveCount(0)

  // closed by key, by button and by a click beside it
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await tile.hover()
  await info.click()
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await expect(dialog).toBeHidden()
  await tile.hover()
  await info.click()
  await page.mouse.click(5, 5)
  await expect(dialog).toBeHidden()

  // the card is dragged as before
  const from = await tile.locator('img').boundingBox()
  const to = await page.getByTestId('pocket').first().boundingBox()
  if (!from || !to) throw new Error('Card or pocket is not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId('pocket').first()).toHaveAttribute('data-card-id', 'sv03.5-001')
})

test('cards are noted from their info and wait on the "Merkliste" to be dragged into a binder', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Merken')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  const savedTab = page.getByRole('tab', { name: /^Merkliste/ })
  const list = page.getByTestId('watchlist')

  // nothing noted yet
  await savedTab.click()
  await expect(list).toContainText('Noch nichts gemerkt.')
  await expect(page.getByTestId('saved-count')).toHaveCount(0)

  // note the first card of "151" from its info
  await page.getByRole('tab', { name: 'Karten' }).click()
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const found = page.getByTestId('search-results').locator('[data-card-id="sv03.5-001"]')
  await expect(found).toBeVisible()
  await expect(found.getByRole('img', { name: 'Auf der Merkliste' })).toHaveCount(0)
  await found.hover()
  await found.getByRole('button', { name: 'Infos zu Bisasam' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await dialog.getByRole('button', { name: 'Merken' }).click()
  await expect(dialog.getByRole('button', { name: 'Gemerkt' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Schließen' }).click()

  // the search result is marked, the tab counts
  await expect(found.getByRole('img', { name: 'Auf der Merkliste' })).toBeVisible()
  await expect(page.getByTestId('saved-count')).toHaveText('1')

  // on the list it can be dragged into the binder like a search result
  await savedTab.click()
  const noted = list.locator('[data-testid="card-tile"][data-card-id="sv03.5-001"]')
  await expect(list).toContainText('1 Karte gemerkt')
  await expect(noted).toContainText('151 · 001/165')
  const from = await noted.locator('img').boundingBox()
  const to = await page.getByTestId('pocket').first().boundingBox()
  if (!from || !to) throw new Error('Card or pocket is not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId('pocket').first()).toHaveAttribute('data-card-id', 'sv03.5-001')
  // placing it does not take it off the list
  await expect(noted).toBeVisible()

  // the list outlives a reload
  await page.reload()
  await expect(page.getByTestId('spread-label')).toBeVisible()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await savedTab.click()
  await expect(noted).toBeVisible()

  // taken off the list again from the same button
  await noted.hover()
  await noted.getByRole('button', { name: 'Infos zu Bisasam' }).click()
  await dialog.getByRole('button', { name: 'Gemerkt' }).click()
  // the card leaves the list, and its info, opened from there, goes with it
  await expect(dialog).toBeHidden()
  await expect(list).toContainText('Noch nichts gemerkt.')
  await expect(page.getByTestId('saved-count')).toHaveCount(0)
})
