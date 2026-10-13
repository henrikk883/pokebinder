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

test('the star notes into "Schnellmerken"; the list waits beside the binder to be dragged from', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Merken')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  const savedTab = page.getByRole('tab', { name: /^Merkliste/ })
  const list = page.getByTestId('watchlist')
  const chooser = page.getByTestId('column-left').getByRole('combobox', { name: 'Merkliste' })

  // nothing noted yet; the quick list is the one shown
  await savedTab.click()
  await expect(list).toContainText('Noch nichts gemerkt.')
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (0)'])
  await expect(page.getByTestId('saved-count')).toHaveCount(0)

  // the star of the first card of "151"
  await page.getByRole('tab', { name: 'Karten' }).click()
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const found = page.getByTestId('search-results').locator('[data-card-id="sv03.5-001"]')
  await expect(found).toBeVisible()
  // not noted: its star only shows when the card is pointed at
  await expect(found.getByRole('button', { name: 'Bisasam merken' })).toHaveCSS('opacity', '0')
  await found.hover()
  await found.getByRole('button', { name: 'Bisasam merken' }).click()
  await page.mouse.move(5, 5)
  await expect(found.getByRole('button', { name: 'Bisasam von der Merkliste nehmen' })).toHaveCSS('opacity', '1')
  await expect(page.getByTestId('saved-count')).toHaveText('1')

  // its info shows the list it is on
  await found.hover()
  await found.getByRole('button', { name: 'Infos zu Bisasam' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bisasam' })
  await expect(dialog.getByTestId('card-info-lists')).toContainText(/Merken auf:\s*Schnellmerken/)
  await dialog.getByRole('button', { name: 'Schließen' }).click()

  // on the list it can be dragged into the binder like a search result
  await savedTab.click()
  const noted = list.locator('[data-testid="card-tile"][data-card-id="sv03.5-001"]')
  await expect(list).toContainText('1 Karte gemerkt')
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)'])
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

  // taken off the list again with the star
  await noted.getByRole('button', { name: 'Bisasam von der Merkliste nehmen' }).click()
  await expect(list).toContainText('Noch nichts gemerkt.')
  await expect(page.getByTestId('saved-count')).toHaveCount(0)
})

test('a card is noted on lists of its own from its info; lists are made, renamed and deleted', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Listen')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const results = page.getByTestId('search-results')
  const first = results.locator('[data-card-id="sv03.5-001"]')
  const second = results.locator('[data-card-id="sv03.5-002"]')
  await expect(first).toBeVisible()
  const dialog = page.getByRole('dialog')
  const chooser = page.getByTestId('column-left').getByRole('combobox', { name: 'Merkliste' })
  const list = page.getByTestId('watchlist')

  // a new list made from the info of a card holds that card
  await first.hover()
  await first.getByRole('button', { name: 'Infos zu Bisasam' }).click()
  // the lists are folded away until asked for
  await dialog.getByTestId('card-info-lists').locator('summary').click()
  await expect(dialog.getByRole('checkbox')).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Anlegen' })).toBeDisabled()
  await dialog.getByLabel('Name einer neuen Liste').fill('Kaufen')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Kaufen' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Schnellmerken' })).not.toBeChecked()
  await expect(dialog.getByLabel('Name einer neuen Liste')).toHaveValue('')
  await dialog.getByRole('button', { name: 'Schließen' }).click()

  // on a list, but not the quick one: the star shows in colour and is not pressed
  await page.mouse.move(5, 5)
  const star = first.getByRole('button', { name: 'Bisasam merken' })
  await expect(star).toHaveCSS('opacity', '1')
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expect(star).toHaveAttribute('data-on-list', 'true')

  // a second card goes onto both lists
  await second.hover()
  await second.getByRole('button', { name: /^Infos zu/ }).click()
  await dialog.getByTestId('card-info-lists').locator('summary').click()
  await dialog.getByRole('checkbox', { name: 'Kaufen' }).check()
  await dialog.getByRole('checkbox', { name: 'Schnellmerken' }).check()
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  // two different cards are noted, one of them twice
  await expect(page.getByTestId('saved-count')).toHaveText('2')

  // beside the binder the list is chosen like a set
  await page.getByRole('tab', { name: /^Merkliste/ }).click()
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)', 'Kaufen (2)'])
  await expect(list.getByTestId('card-tile')).toHaveCount(1)
  await chooser.selectOption({ label: 'Kaufen (2)' })
  await expect(list.getByTestId('card-tile')).toHaveCount(2)

  // the quick list can be neither renamed nor deleted, a list of one's own can
  await chooser.selectOption({ label: 'Schnellmerken (1)' })
  await expect(page.getByTestId('column-left').getByRole('button', { name: 'Umbenennen' })).toBeDisabled()
  await expect(page.getByTestId('column-left').getByRole('button', { name: 'Löschen' })).toBeDisabled()
  await chooser.selectOption({ label: 'Kaufen (2)' })
  await page.getByTestId('column-left').getByRole('button', { name: 'Umbenennen' }).click()
  const prompt = page.getByRole('dialog', { name: 'Liste umbenennen' })
  await expect(prompt.getByLabel('Name der Liste')).toHaveValue('Kaufen')
  await prompt.getByLabel('Name der Liste').fill('Wunschzettel')
  await prompt.getByRole('button', { name: 'Umbenennen' }).click()
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)', 'Wunschzettel (2)'])
  await expect(chooser).toHaveValue(/.+/)
  await expect(list.getByTestId('card-tile')).toHaveCount(2)

  // a third list from the button, empty at first
  await page.getByTestId('column-left').getByRole('button', { name: 'Neue Liste' }).click()
  const create = page.getByRole('dialog', { name: 'Neue Liste' })
  await create.getByLabel('Name der Liste').fill('Michi-Binder')
  await create.getByRole('button', { name: 'Anlegen' }).click()
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)', 'Wunschzettel (2)', 'Michi-Binder (0)'])
  await expect(list).toContainText('Diese Liste ist leer.')

  // everything is still there after a reload
  await page.reload()
  await expect(page.getByTestId('spread-label')).toBeVisible()
  await page.getByRole('tab', { name: /^Merkliste/ }).click()
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)', 'Wunschzettel (2)', 'Michi-Binder (0)'])

  // deleting a list asks first and leaves the others as they are
  await chooser.selectOption({ label: 'Wunschzettel (2)' })
  await page.getByTestId('column-left').getByRole('button', { name: 'Löschen' }).click()
  const question = page.getByRole('alertdialog', { name: 'Liste „Wunschzettel“ löschen?' })
  await question.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(chooser.locator('option')).toHaveCount(3)
  await page.getByTestId('column-left').getByRole('button', { name: 'Löschen' }).click()
  await question.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(chooser.locator('option')).toHaveText(['Schnellmerken (1)', 'Michi-Binder (0)'])
  // the view falls back to the quick list
  await expect(list.getByTestId('card-tile')).toHaveCount(1)
  await expect(page.getByTestId('saved-count')).toHaveText('1')
})

test('a list adds up what its cards would cost, beside the binder and on the page "Karten"', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Kosten')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const results = page.getByTestId('search-results')
  for (const id of ['sv03.5-001', 'sv03.5-009']) {
    const tile = results.locator(`[data-card-id="${id}"]`)
    await tile.scrollIntoViewIfNeeded()
    await tile.hover()
    await tile.getByRole('button', { name: /merken$/ }).click()
  }
  /** "Summe: 1.234,50 €" → 1234.5 */
  const euros = (text: string) =>
    Number((/Summe: ([0-9.,]+) €/.exec(text)?.[1] ?? '').replaceAll('.', '').replace(',', '.'))

  // beside the binder the sum stands at the bottom of the list, worked out on request
  await page.getByRole('tab', { name: /^Merkliste/ }).click()
  const worth = page.getByTestId('list-worth')
  await expect(worth.getByTestId('list-value')).toHaveCount(0)
  await worth.getByRole('button', { name: 'Wert berechnen' }).click()
  await expect(worth.getByTestId('list-value')).toHaveText(/^Summe: [0-9.]+,[0-9]{2} €/)
  const total = euros((await worth.getByTestId('list-value').textContent()) ?? '')
  expect(total).toBeGreaterThan(0)
  // the sum takes the place of the button
  await expect(worth.getByRole('button', { name: 'Wert berechnen' })).toHaveCount(0)

  // a changed list has no sum until it is asked for again
  const noted = page.getByTestId('watchlist').locator('[data-card-id="sv03.5-009"]')
  await noted.getByRole('button', { name: /von der Merkliste nehmen$/ }).click()
  await expect(worth.getByTestId('list-value')).toHaveCount(0)
  await worth.getByRole('button', { name: 'Wert berechnen' }).click()
  await expect(worth.getByTestId('list-value')).toHaveText(/^Summe: [0-9.]+,[0-9]{2} €/)
  expect(euros((await worth.getByTestId('list-value').textContent()) ?? '')).toBeLessThanOrEqual(total)

  // the same on the page "Karten", beside the number of cards
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByTestId('page').getByRole('tab', { name: /^Merkliste/ }).click()
  const wide = page.getByTestId('browse-watchlist')
  await wide.getByRole('button', { name: 'Wert berechnen' }).click()
  await expect(wide.getByTestId('list-value')).toHaveText(/^Summe: [0-9.]+,[0-9]{2} €/)

  // an empty list has nothing to add up
  await wide.getByRole('button', { name: /von der Merkliste nehmen$/ }).click()
  await expect(wide.getByRole('button', { name: 'Wert berechnen' })).toHaveCount(0)
  await expect(wide).toContainText('Noch nichts gemerkt.')
})

test('a Pokémon is found by its English name while German cards are shown', async ({ page, tcgdex }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: searchField }).fill('psyduck')

  const tiles = page.getByTestId('card-tile')
  await expect(tiles.first()).toBeVisible()
  // the cards come in German: it is Enton that is shown
  await expect(tiles.filter({ hasText: 'Enton' })).toHaveCount(await tiles.count())
  await expect(page.locator('[data-card-id="sv03.5-054"]')).toContainText('151 · 054/165')
  // nothing under the name as typed, so the English data was asked which Pokémon it is
  expect(tcgdex.requests).toContain('de/cards?name=psyduck&pagination:page=1&pagination:itemsPerPage=60')
  expect(tcgdex.requests).toContain('graphql:names:en:psyduck')
  expect(tcgdex.requests).toContain('de/cards?dexId=eq:54&pagination:page=1&pagination:itemsPerPage=60')

  // a name that finds cards as it is asks no other language
  const before = tcgdex.requests.filter((request) => request.startsWith('graphql:names:')).length
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await expect(tiles.filter({ hasText: 'Glurak' }).first()).toBeVisible()
  expect(tcgdex.requests.filter((request) => request.startsWith('graphql:names:')).length).toBe(before)
})

test('cards are found by who drew them, alone or together with a name and a kind of card', async ({ page }) => {
  await page.goto('/')
  const illustrator = page.getByLabel('Illustrator').first()
  const tiles = page.getByTestId('card-tile')

  // the artists TCGdex knows are offered, and a name can be typed
  await expect(page.locator('datalist option[value="Mitsuhiro Arita"]')).toHaveCount(1)
  await illustrator.fill('Mitsuhiro Arita')
  await expect(page.getByTestId('search-results').getByRole('status')).toContainText(/^[0-9]+[+] Karten/)

  // narrowed down by a name
  await page.getByRole('searchbox', { name: searchField }).fill('Glurak')
  await expect(tiles).toHaveCount(7)
  await expect(tiles.filter({ hasText: 'Glurak' })).toHaveCount(7)

  // and by the kind of card: all of them are Pokémon, none is a trainer
  const kind = page.getByRole('combobox', { name: 'Kartenart' }).first()
  await expect(kind.locator('option')).toHaveText(['Kartenart', 'Energie', 'Pokémon', 'Trainer'])
  await kind.selectOption('Pokémon')
  await expect(tiles).toHaveCount(7)
  await kind.selectOption('Trainer')
  await expect(page.getByTestId('search-results')).toContainText('Keine Karten gefunden.')

  // taking the artist out again brings back every Glurak
  await kind.selectOption('')
  await illustrator.fill('')
  await expect(page.locator('[data-card-id="sv03.5-006"]')).toBeVisible()
})

test('what was chosen in the search stays when the language of the cards is changed', async ({ page }) => {
  await page.goto('/')
  const column = page.getByTestId('column-left')
  const tiles = column.getByTestId('search-results').getByTestId('card-tile')
  await column.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(tiles).toHaveCount(207)
  await expect(tiles.first()).toContainText('Bisasam')
  await column.getByLabel('Illustrator').fill('x')

  await column.getByRole('combobox', { name: 'Sprache der Karten' }).selectOption('Englisch')

  // the same set, now with its English cards; what was typed is still there
  await expect(tiles.first()).toContainText('Bulbasaur')
  await expect(tiles).toHaveCount(207)
  await expect(column.getByRole('button', { name: 'Set', exact: true })).toContainText('151')
  await expect(column.getByLabel('Illustrator')).toHaveValue('x')

  // and back again
  await column.getByRole('combobox', { name: 'Sprache der Karten' }).selectOption('Deutsch')
  await expect(tiles.first()).toContainText('Bisasam')
  await expect(column.getByLabel('Illustrator')).toHaveValue('x')
})
