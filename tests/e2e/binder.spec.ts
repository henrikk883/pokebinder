import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function createBinder(page: Page, name: string, layout = '3 × 3') {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByText(layout, { exact: true }).click()
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

/** Shows all 207 cards of the set "151" in the search column. */
async function showSet151(page: Page) {
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('card-tile')).toHaveCount(207)
}

function tile(page: Page, cardId: string): Locator {
  return page.locator(`[data-testid="card-tile"][data-card-id="${cardId}"] img`)
}

/** Pocket by page number and position, both starting at 1 as shown in the UI. */
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

const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('a card dragged from the search into a pocket is still there after a reload', async ({ page }) => {
  await createBinder(page, 'Kanto Collection')
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')

  await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 5))

  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(pocket(page, 1, 5).getByRole('img', { name: 'Glurak-ex' })).toHaveAttribute(
    'src',
    /sv03\.5\/006\/high\.webp$/,
  )
  await saved(page)

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(pocket(page, 1, 5).getByRole('img', { name: 'Glurak-ex' })).toBeVisible()
  await expect(page.getByTestId('pocket').and(page.locator('[data-card-id=""]'))).toHaveCount(8)
})

test('a card without a German scan shows the English one, whatever lay in the pocket before', async ({ page }) => {
  await createBinder(page, 'Ersatzbilder')
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await page.getByRole('button', { name: 'Mehr laden' }).click()
  await expect(page.getByRole('button', { name: 'Mehr laden' })).toBeHidden()
  const searchTile = (cardId: string) => page.locator(`[data-testid="card-tile"][data-card-id="${cardId}"] > div`)

  // TCGdex has no scan at all of this promo, neither German nor English
  await drag(page, searchTile('smp-SM195'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'smp-SM195')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Glurak GX (kein Bild vorhanden)' })).toBeVisible()

  // of this one there is an English scan; it appears although the pocket just failed to load one
  await drag(page, searchTile('smp-SM158'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'smp-SM158')
  const substitute = pocket(page, 1, 1).getByRole('img', { name: 'Glurak (englisches Bild)' })
  await expect(substitute).toHaveAttribute('src', /assets\.tcgdex\.net\/en\/sm\/smp\/SM158\/high\.webp$/)
  await expect.poll(() => substitute.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'de')

  // the same after turning pages: page 2 reuses the pockets that showed page 1
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await drag(page, searchTile('smp-SM195'), pocket(page, 3, 1))
  await expect(pocket(page, 3, 1).getByRole('img', { name: 'Glurak GX (kein Bild vorhanden)' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurückblättern' }).click()
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Glurak (englisches Bild)' })).toBeVisible()
})

test('a card TCGdex has no picture of gets one from the second image source', async ({ page, tcgdex }) => {
  // pokemontcg.io has this promo; TCGdex has neither a German nor an English scan of it
  tcgdex.otherImages.add('https://images.pokemontcg.io/smp/SM195.png')
  tcgdex.otherImages.add('https://images.pokemontcg.io/smp/SM195_hires.png')
  await createBinder(page, 'Zweite Quelle')
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await page.getByRole('button', { name: 'Mehr laden' }).click()
  await expect(page.getByRole('button', { name: 'Mehr laden' })).toBeHidden()

  // in the search: the small scan
  const searchTile = page.locator('[data-testid="card-tile"][data-card-id="smp-SM195"]')
  await searchTile.scrollIntoViewIfNeeded()
  const small = searchTile.getByRole('img', { name: 'Glurak GX (englisches Bild)' })
  await expect(small).toHaveAttribute('src', 'https://images.pokemontcg.io/smp/SM195.png')
  await expect.poll(() => small.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  // in the binder: the high resolution scan; the card stays a German card
  await drag(page, searchTile.locator('> div'), pocket(page, 1, 1))
  const large = pocket(page, 1, 1).getByRole('img', { name: 'Glurak GX (englisches Bild)' })
  await expect(large).toHaveAttribute('src', 'https://images.pokemontcg.io/smp/SM195_hires.png')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-lang', 'de')

  // the second source is asked only where TCGdex has nothing: never for cards with a scan
  const asked = new Set(tcgdex.otherImageRequests.map((url) => url.split('/').slice(3, 5).join('/')))
  expect([...asked].some((path) => path.startsWith('sv3pt5/'))).toBe(false)
  expect(asked.has('smp/SM195.png')).toBe(true)
})

test('a new binder opens on page 1 next to the cover, with the chosen layout', async ({ page }) => {
  await createBinder(page, 'Mein 4er', '4 × 4')

  await expect(page.getByRole('region', { name: 'Cover-Innenseite' })).toContainText('Mein 4er')
  await expect(page.getByTestId('pocket')).toHaveCount(16)
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 1')
  await expect(page.getByText('Seite 1 · Öffnung rechts')).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('Mein 4er')
})

test('cards swap places on an occupied pocket and move across pages', async ({ page }) => {
  await createBinder(page, 'Tausch')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
  await showSet151(page)

  await drag(page, tile(page, 'sv03.5-001'), pocket(page, 2, 1))
  await drag(page, tile(page, 'sv03.5-002'), pocket(page, 2, 2))
  await expect(pocket(page, 2, 2)).toHaveAttribute('data-card-id', 'sv03.5-002')

  // onto an occupied pocket: the two cards trade places
  await drag(page, pocket(page, 2, 1), pocket(page, 2, 2))
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-002')
  await expect(pocket(page, 2, 2)).toHaveAttribute('data-card-id', 'sv03.5-001')

  // onto an empty pocket of the facing page: the card moves
  await drag(page, pocket(page, 2, 1), pocket(page, 3, 9))
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', '')
  await expect(pocket(page, 3, 9)).toHaveAttribute('data-card-id', 'sv03.5-002')

  // from the search onto an occupied pocket: the new card replaces the old one
  await drag(page, tile(page, 'sv03.5-003'), pocket(page, 2, 2))
  await expect(pocket(page, 2, 2)).toHaveAttribute('data-card-id', 'sv03.5-003')
})

test('a pocket is emptied by right click, the Delete key or the button', async ({ page }) => {
  await createBinder(page, 'Leeren')
  await showSet151(page)
  for (const [cardId, position] of [['sv03.5-001', 1], ['sv03.5-002', 2], ['sv03.5-003', 3]] as const) {
    await drag(page, tile(page, cardId), pocket(page, 1, position))
    await expect(pocket(page, 1, position)).toHaveAttribute('data-card-id', cardId)
  }

  await pocket(page, 1, 1).click({ button: 'right' })
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', '')

  await pocket(page, 1, 2).click()
  await page.keyboard.press('Delete')
  await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', '')

  await pocket(page, 1, 3).click()
  await page.getByRole('button', { name: 'Pocket leeren' }).click()
  await expect(pocket(page, 1, 3)).toHaveAttribute('data-card-id', '')
  await expect(page.getByRole('button', { name: 'Pocket leeren' })).toBeDisabled()
})

test('the selection column shows the chosen card and its place', async ({ page }) => {
  await createBinder(page, 'Karte wählen')
  await expect(page.getByText('Kein Pocket ausgewählt.')).toBeVisible()
  await showSet151(page)
  await drag(page, tile(page, 'sv03.5-025'), pocket(page, 1, 2))

  // the pocket a card was dropped on is selected right away
  const panel = page.getByTestId('column-right')
  await expect(pocket(page, 1, 2)).toHaveAttribute('aria-pressed', 'true')
  await expect(panel).toContainText('Pikachu')
  await expect(panel).toContainText('151 · 025/165')
  await expect(panel.getByText('Seite').locator('xpath=following-sibling::dd')).toHaveText('1')
  await expect(panel.getByText('Position').locator('xpath=following-sibling::dd')).toHaveText('2')

  await pocket(page, 1, 9).click()
  await expect(panel).toContainText('Leerer Pocket')
})

test('a card marked as missing turns black and white, also after a reload', async ({ page }) => {
  await createBinder(page, 'Fehlt')
  await showSet151(page)
  await drag(page, tile(page, 'sv03.5-025'), pocket(page, 1, 1))
  const image = pocket(page, 1, 1).getByRole('img', { name: 'Pikachu' })
  await expect(image).toHaveCSS('filter', 'none')

  // the button appears when the mouse is over the card
  const toggle = pocket(page, 1, 1).getByRole('button', { name: 'Als fehlend markieren' })
  await page.mouse.move(0, 0)
  await expect(toggle).toHaveCSS('opacity', '0')
  await pocket(page, 1, 1).hover()
  await expect(toggle).toHaveCSS('opacity', '1')
  await toggle.click()

  await expect(image).toHaveCSS('filter', 'grayscale(1)')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'false')
  await saved(page)

  await page.reload()
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Pikachu' })).toHaveCSS('filter', 'grayscale(1)')

  // and back, this time through the selection column
  await pocket(page, 1, 1).click()
  await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Vorhanden' }).click()
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Pikachu' })).toHaveCSS('filter', 'none')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')
})

test('pages turn with buttons, arrow keys and thumbnails', async ({ page }) => {
  await createBinder(page, 'Blättern')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  const label = page.getByTestId('spread-label')

  // a new page opens the binder where that page is
  await expect(label).toHaveText('Seiten 4 – 5')
  await expect(page.getByRole('button', { name: 'Weiterblättern' })).toBeDisabled()

  await page.getByRole('button', { name: 'Zurückblättern' }).click()
  await expect(label).toHaveText('Seiten 2 – 3')
  await expect(page.getByRole('region', { name: 'Seite 2', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Seite 3', exact: true })).toBeVisible()

  await page.keyboard.press('ArrowLeft')
  await expect(label).toHaveText('Seite 1')
  await expect(page.getByRole('button', { name: 'Zurückblättern' })).toBeDisabled()
  await page.keyboard.press('ArrowLeft')
  await expect(label).toHaveText('Seite 1')

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(label).toHaveText('Seiten 4 – 5')

  const thumbnails = page.getByRole('navigation', { name: 'Doppelseiten' })
  await expect(thumbnails.getByRole('button')).toHaveCount(3)
  await expect(thumbnails.getByRole('button', { name: 'Seiten 4 – 5' })).toHaveAttribute('aria-current', 'page')
  await thumbnails.getByRole('button', { name: 'Seite 1' }).click()
  await expect(label).toHaveText('Seite 1')
  await expect(thumbnails.getByRole('button', { name: 'Seite 1' })).toHaveAttribute('aria-current', 'page')
})

test('arrow keys in the search field do not turn pages', async ({ page }) => {
  await createBinder(page, 'Tippen')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')

  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await page.keyboard.press('ArrowLeft')

  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
})

test('a page can be deleted, with a question when it holds cards', async ({ page }) => {
  await createBinder(page, 'Löschen')
  await expect(page.getByRole('button', { name: 'Seite 1 löschen' })).toBeDisabled()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await showSet151(page)
  await drag(page, tile(page, 'sv03.5-001'), pocket(page, 3, 1))
  await expect(pocket(page, 3, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

  // an empty page goes without asking; page 3 moves up and becomes page 2
  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 2')
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

  // a page with cards asks first, in the app's own dialog
  const question = page.getByRole('alertdialog', { name: 'Seite 2 löschen?' })
  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
  await expect(question).toContainText('Seite 2 wird mit allen Karten darauf gelöscht.')
  await question.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(question).toBeHidden()
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

  // Escape declines as well
  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
  await page.keyboard.press('Escape')
  await expect(question).toBeHidden()
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
  await question.getByRole('button', { name: 'Seite löschen' }).click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 1')
  await expect(page.getByTestId('pocket')).toHaveCount(9)
})

test('zoom scales the open binder between 50 and 150 %', async ({ page }) => {
  await createBinder(page, 'Zoom')
  const spread = page.getByTestId('binder-spread')
  const value = page.getByTestId('zoom-value')
  const width = async () => (await spread.boundingBox())?.width ?? 0

  await expect(value).toHaveText('80 %')
  const initial = await width()

  await page.getByRole('button', { name: 'Vergrößern' }).click()
  await expect(value).toHaveText('85 %')
  expect(await width()).toBeCloseTo((initial / 80) * 85, 0)

  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Verkleinern' }).click({ force: true })
  await expect(value).toHaveText('50 %')
  await expect(page.getByRole('button', { name: 'Verkleinern' })).toBeDisabled()
  expect(await width()).toBeCloseTo((initial / 80) * 50, 0)

  for (let i = 0; i < 25; i++) await page.getByRole('button', { name: 'Vergrößern' }).click({ force: true })
  await expect(value).toHaveText('150 %')
  await expect(page.getByRole('button', { name: 'Vergrößern' })).toBeDisabled()

  // the side columns stay as they are
  expect((await page.getByTestId('column-left').boundingBox())?.width).toBe(300)
  expect((await page.getByTestId('column-right').boundingBox())?.width).toBe(300)
})

test('sorting orders a page, or the whole binder, by set and number', async ({ page }) => {
  await createBinder(page, 'Sortieren', '2 × 2')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await showSet151(page)
  await drag(page, tile(page, 'sv03.5-009'), pocket(page, 2, 2))
  await drag(page, tile(page, 'sv03.5-004'), pocket(page, 2, 4))
  await drag(page, tile(page, 'sv03.5-007'), pocket(page, 3, 3))
  await drag(page, tile(page, 'sv03.5-001'), pocket(page, 3, 4))
  await expect(pocket(page, 3, 4)).toHaveAttribute('data-card-id', 'sv03.5-001')

  const cardsOn = (pageNumber: number) =>
    page
      .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
      .getByTestId('pocket')
      .evaluateAll((pockets) => pockets.map((item) => item.getAttribute('data-card-id')))

  await page.getByRole('button', { name: 'Sortieren' }).click()
  await page.getByRole('menuitem', { name: 'Seite 3 sortieren' }).click()
  await expect.poll(() => cardsOn(3)).toEqual(['sv03.5-001', 'sv03.5-007', '', ''])
  expect(await cardsOn(2)).toEqual(['', 'sv03.5-009', '', 'sv03.5-004'])

  await page.getByRole('button', { name: 'Sortieren' }).click()
  await page.getByRole('menuitem', { name: 'Ganzen Binder sortieren' }).click()
  await page.getByRole('button', { name: 'Zurückblättern' }).click()
  await expect.poll(() => cardsOn(1)).toEqual(['sv03.5-001', 'sv03.5-004', 'sv03.5-007', 'sv03.5-009'])
})

test('changing the layout redistributes the cards after a question', async ({ page }) => {
  await createBinder(page, 'Layout', '2 × 2')
  await showSet151(page)
  for (const [cardId, position] of [['sv03.5-001', 1], ['sv03.5-002', 2], ['sv03.5-003', 3], ['sv03.5-004', 4]] as const) {
    await drag(page, tile(page, cardId), pocket(page, 1, position))
    await expect(pocket(page, 1, position)).toHaveAttribute('data-card-id', cardId)
  }

  // the layout sits in the menu "Mehr", with the current one ticked
  const more = page.getByRole('button', { name: 'Mehr', exact: true })
  await more.click()
  await expect(page.getByRole('menuitemradio', { name: '2 × 2' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: '3 × 3' }).click()
  const question = page.getByRole('alertdialog', { name: 'Layout auf 3 × 3 ändern?' })
  await expect(question).toContainText('neu auf die Seiten verteilt')
  await question.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByTestId('pocket')).toHaveCount(4)

  await more.click()
  await expect(page.getByRole('menuitemradio', { name: '2 × 2' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: '3 × 3' }).click()
  await question.getByRole('button', { name: 'Layout ändern' }).click()
  await expect(page.getByTestId('pocket')).toHaveCount(9)
  await expect(pocket(page, 1, 4)).toHaveAttribute('data-card-id', 'sv03.5-004')
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', '')
})

test('the opening side is set per page and marked on every pocket', async ({ page }) => {
  await createBinder(page, 'Öffnung')
  const markers = page.getByTestId('pocket-opening')
  await expect(markers).toHaveCount(9)
  expect(await markers.evaluateAll((items) => items.map((item) => item.getAttribute('data-side')))).toEqual(
    Array.from({ length: 9 }, () => 'right'),
  )

  await pocket(page, 1, 1).click()
  await page.getByLabel('Öffnung der Seite').selectOption('left')

  await expect(page.getByText('Seite 1 · Öffnung links')).toBeVisible()
  await expect(markers.first()).toHaveAttribute('data-side', 'left')
  const box = await pocket(page, 1, 1).boundingBox()
  const marker = await markers.first().boundingBox()
  if (!box || !marker) throw new Error('Pocket or marker not visible')
  expect(marker.x - box.x).toBeLessThan(3)

  await saved(page)
  await page.reload()
  await expect(page.getByText('Seite 1 · Öffnung links')).toBeVisible()
})

test('mixed opening follows the pattern of bought binders on right and left pages', async ({ page }) => {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill('Gekaufter Binder')
  await dialog.getByText('Öffnung gemischt', { exact: true }).click()
  await expect(dialog.getByText(/Die äußere Spalte öffnet zur Mitte/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Anlegen' }).click()

  const sidesOn = (pageNumber: number) =>
    page
      .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
      .getByTestId('pocket-opening')
      .evaluateAll((markers) => markers.map((marker) => marker.getAttribute('data-side')))
  const rows = (pattern: string[]) => [...pattern, ...pattern, ...pattern]

  // page 1 lies on the right
  await expect(page.getByText('Seite 1 · Öffnung gemischt')).toBeVisible()
  expect(await sidesOn(1)).toEqual(rows(['right', 'right', 'left']))

  // new pages take over the setting; page 2 lies on the left, page 3 on the right
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  expect(await sidesOn(2)).toEqual(rows(['right', 'left', 'left']))
  expect(await sidesOn(3)).toEqual(rows(['right', 'right', 'left']))

  // a single page can still be set differently, and back
  await pocket(page, 3, 1).click()
  await page.getByLabel('Öffnung der Seite').selectOption('left')
  expect(await sidesOn(3)).toEqual(rows(['left', 'left', 'left']))
  await page.getByLabel('Öffnung der Seite').selectOption('mixed')
  expect(await sidesOn(3)).toEqual(rows(['right', 'right', 'left']))
})

test('"Meine Binder" lists the binders; they can be opened and deleted', async ({ page }) => {
  await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()
  await createBinder(page, 'Erster Binder')
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  await createBinder(page, 'Zweiter Binder', '2 × 2')
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()

  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zweiter Binder öffnen' })).toContainText('2 × 2 · 1 Seite · 0 Karten')
  // without an open binder there is nothing to drag cards into
  await expect(page.getByText('Karten in einen Pocket ziehen')).toBeHidden()

  await page.getByRole('button', { name: 'Erster Binder öffnen' }).click()
  await expect(page.getByRole('heading', { name: 'Erster Binder' })).toBeVisible()
  await expect(page.getByTestId('pocket')).toHaveCount(9)
  await expect(page.getByText('Karten in einen Pocket ziehen')).toBeVisible()

  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  const question = page.getByRole('alertdialog', { name: 'Binder „Erster Binder“ löschen?' })
  await page.getByRole('button', { name: 'Erster Binder löschen' }).click()
  await question.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('button', { name: 'Erster Binder öffnen' })).toBeVisible()

  await page.getByRole('button', { name: 'Erster Binder löschen' }).click()
  await question.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Erster Binder öffnen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zweiter Binder öffnen' })).toBeVisible()
})

test('the shelf is ordered by last change, by name or by hand; the choice is remembered', async ({ page }) => {
  const toList = () => page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  const tile = (name: string) => page.locator(`[data-testid="binder-tile"][data-binder-name="${name}"]`)
  const shelf = () =>
    page
      .getByTestId('binder-tile')
      .evaluateAll((tiles) => tiles.map((entry) => entry.getAttribute('data-binder-name')))
  for (const name of ['Zebra', 'Apfel', 'Mitte']) {
    await createBinder(page, name)
    await toList()
  }
  const sort = page.getByRole('combobox', { name: 'Sortierung' })

  // as before: the binder changed last stands in front
  await expect(sort).toHaveValue('updated')
  await expect.poll(shelf).toEqual(['Mitte', 'Apfel', 'Zebra'])
  await expect(page.getByRole('button', { name: 'Zebra nach vorn' })).toHaveCount(0)

  await sort.selectOption({ label: 'Alphabetisch' })
  await expect.poll(shelf).toEqual(['Apfel', 'Mitte', 'Zebra'])
  // only the own order can be changed by dragging
  await drag(page, tile('Zebra').getByTestId('binder-cover'), tile('Apfel'))
  await expect.poll(shelf).toEqual(['Apfel', 'Mitte', 'Zebra'])
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()

  // the own order starts from "changed last" and is changed by dragging a binder onto another
  await sort.selectOption({ label: 'Eigene Reihenfolge' })
  await expect.poll(shelf).toEqual(['Mitte', 'Apfel', 'Zebra'])
  await drag(page, tile('Zebra').getByTestId('binder-cover'), tile('Mitte'))
  await expect.poll(shelf).toEqual(['Zebra', 'Mitte', 'Apfel'])
  // dragging does not open the binder
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()

  // by keyboard: one place at a time. For 50 ms after a drag, dnd-kit swallows clicks, so
  // that letting go does not count as one; nobody is that fast, but this test is.
  await page.waitForTimeout(150)
  await expect(page.getByRole('button', { name: 'Zebra nach vorn' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Apfel nach hinten' })).toBeDisabled()
  await page.getByRole('button', { name: 'Apfel nach vorn' }).click()
  await expect.poll(shelf).toEqual(['Zebra', 'Apfel', 'Mitte'])

  // remembered after a reload, and a click still opens a binder
  await page.reload()
  // the app comes back with the binder changed last; wait for it before going to the shelf
  await expect(page.getByTestId('spread-label')).toBeVisible()
  await toList()
  await expect(sort).toHaveValue('custom')
  await expect.poll(shelf).toEqual(['Zebra', 'Apfel', 'Mitte'])

  // a new binder stands in front; a deleted one leaves the others in place
  await createBinder(page, 'Neu')
  await toList()
  await expect.poll(shelf).toEqual(['Neu', 'Zebra', 'Apfel', 'Mitte'])
  await page.getByRole('button', { name: 'Apfel löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect.poll(shelf).toEqual(['Neu', 'Zebra', 'Mitte'])
  await tile('Mitte').getByTestId('binder-cover').click()
  await expect(page.getByRole('heading', { name: 'Mitte' })).toBeVisible()

  // changing a binder does not disturb the own order
  await toList()
  await expect.poll(shelf).toEqual(['Neu', 'Zebra', 'Mitte'])
  await sort.selectOption({ label: 'Zuletzt geändert' })
  await expect.poll(shelf).toEqual(['Neu', 'Mitte', 'Zebra'])
})

test('a binder is renamed in the editor and in the list; undo takes the name back', async ({ page }) => {
  await createBinder(page, 'Kanto')
  await expect(page.getByRole('region', { name: 'Cover-Innenseite' })).toContainText('Kanto')

  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Binder umbenennen' }).click()
  const prompt = page.getByRole('dialog', { name: 'Binder umbenennen' })
  await expect(prompt.getByLabel('Name')).toHaveValue('Kanto')
  await prompt.getByLabel('Name').fill('Kanto Collection')
  await prompt.getByRole('button', { name: 'Umbenennen' }).click()

  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('Kanto Collection')
  // the cover carried the binder's name, so it follows
  await expect(page.getByRole('region', { name: 'Cover-Innenseite' })).toContainText('Kanto Collection')

  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(page.getByRole('heading', { name: 'Kanto', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Wiederholen' }).click()
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()

  // an empty name or "cancel" changes nothing
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Binder umbenennen' }).click()
  await prompt.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()

  // in the list, without opening the binder
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  await page.getByRole('button', { name: 'Kanto Collection umbenennen' }).click()
  await prompt.getByLabel('Name').fill('Erste Generation')
  await prompt.getByLabel('Name').press('Enter')
  await expect(page.getByRole('button', { name: 'Erste Generation öffnen' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Erste Generation' })).toBeVisible()
})

test('the toolbar fits in one row; rarely used actions sit under "Mehr"', async ({ page }) => {
  await createBinder(page, 'Ein ziemlich langer Bindername für den Test')
  const heading = page.getByRole('heading', { name: /Ein ziemlich langer/ })
  const addPage = page.getByRole('button', { name: 'Seite hinzufügen' })
  const top = async (locator: Locator) => (await locator.boundingBox())?.y ?? -1

  // same height: nothing wrapped into a second row
  expect(Math.abs((await top(page.getByRole('button', { name: 'Sortieren' }))) - (await top(addPage)))).toBeLessThan(2)
  expect(Math.abs((await top(heading)) - (await top(addPage)))).toBeLessThan(12)

  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Binder umbenennen'])
  await expect(page.getByRole('menuitemradio')).toHaveText(['2 × 2', '✓3 × 3', '4 × 4'])
})

test('sorting by Pokédex number brings the Pokémon in order, trainers last', async ({ page }) => {
  await createBinder(page, 'Pokédex')
  await showSet151(page)
  // Pikachu (25), Bisasam (1), the trainer "Erikas Einladung", Glurak-ex (6), Pikachu as illustration rare (25)
  for (const [cardId, position] of [
    ['sv03.5-025', 1],
    ['sv03.5-001', 2],
    ['sv03.5-196', 3],
    ['sv03.5-006', 5],
    ['sv03.5-173', 7],
  ] as const) {
    await drag(page, tile(page, cardId), pocket(page, 1, position))
    await expect(pocket(page, 1, position)).toHaveAttribute('data-card-id', cardId)
  }

  await page.getByRole('button', { name: 'Sortieren' }).click()
  await expect(page.getByRole('menuitem')).toHaveText([
    'Seite 1 sortieren',
    'Ganzen Binder sortieren',
    'Seite 1 nach Pokédex',
    'Ganzen Binder nach Pokédex',
  ])
  await page.getByRole('menuitem', { name: 'Seite 1 nach Pokédex' }).click()

  const cards = () =>
    page.getByTestId('pocket').evaluateAll((pockets) => pockets.map((item) => item.getAttribute('data-card-id')))
  await expect
    .poll(cards)
    .toEqual(['sv03.5-001', 'sv03.5-006', 'sv03.5-025', 'sv03.5-173', 'sv03.5-196', '', '', '', ''])

  // one step back and the page lies as it was placed
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(cards).toEqual(['sv03.5-025', 'sv03.5-001', 'sv03.5-196', '', 'sv03.5-006', '', 'sv03.5-173', '', ''])
})

test('pages are moved, duplicated and inserted; the thumbnails are dragged onto each other', async ({ page }) => {
  await createBinder(page, 'Seiten')
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
  const label = page.getByTestId('spread-label')
  const miniPage = (number: number) => page.locator(`[data-testid="mini-page"][data-page-number="${number}"]`)
  /** The page the card lies on, read from the thumbnails: its mini page has a filled pocket. */
  const cardPages = () =>
    page
      .getByTestId('mini-page')
      .evaluateAll((pages) =>
        pages.flatMap((entry) =>
          entry.querySelector('.bg-muted') ? [Number(entry.getAttribute('data-page-number'))] : [],
        ),
      )
  await expect.poll(cardPages).toEqual([1])

  // by button: the page of the selected pocket moves back, and the view follows it
  await page.getByRole('button', { name: 'Seite 1', exact: true }).click()
  await pocket(page, 1, 1).click()
  await expect(page.getByRole('button', { name: 'Nach vorn' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nach hinten' }).click()
  await expect(label).toHaveText('Seiten 2 – 3')
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(pocket(page, 2, 1)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(cardPages).toEqual([2])

  // by dragging its thumbnail onto another page
  await drag(page, miniPage(2), miniPage(3))
  await expect.poll(cardPages).toEqual([3])
  await expect(pocket(page, 3, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await drag(page, miniPage(3), miniPage(1))
  await expect.poll(cardPages).toEqual([1])
  await expect(label).toHaveText('Seite 1')
  // a click on a thumbnail still only turns the pages
  await page.getByRole('button', { name: 'Seiten 2 – 3' }).click()
  await expect(label).toHaveText('Seiten 2 – 3')
  await expect.poll(cardPages).toEqual([1])

  // a copy lands right behind the page, with its cards
  await page.getByRole('button', { name: 'Seite 1', exact: true }).click()
  await pocket(page, 1, 1).click()
  await page.getByRole('button', { name: 'Duplizieren' }).click()
  await expect.poll(cardPages).toEqual([1, 2])
  await expect(page.getByTestId('mini-page')).toHaveCount(4)

  // an empty page in front of the selected one pushes it back
  await page.getByRole('button', { name: 'Leere Seite davor' }).click()
  await expect.poll(cardPages).toEqual([2, 3])
  await expect(page.getByTestId('mini-page')).toHaveCount(5)
  await expect(label).toHaveText('Seiten 2 – 3')
  await expect(pocket(page, 2, 1)).toHaveAttribute('aria-pressed', 'true')

  // every step can be taken back, and what is left is stored
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(cardPages).toEqual([1, 2])
  await saved(page)
  await page.reload()
  await expect(label).toBeVisible()
  await expect.poll(cardPages).toEqual([1, 2])
  await expect(page.getByTestId('mini-page')).toHaveCount(4)

  // while cards are ticked off, pages stay where they are
  await pocket(page, 1, 1).click()
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await expect(page.getByRole('button', { name: 'Duplizieren' })).toHaveCount(0)
  await drag(page, miniPage(1), miniPage(3))
  await expect.poll(cardPages).toEqual([1, 2])
})

test('a gap is made between cards and closed again; the cards behind it move along', async ({ page }) => {
  await createBinder(page, 'Lücken', '2 × 2')
  // the first three cards of "151"
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const ids = ['sv03.5-001', 'sv03.5-002', 'sv03.5-003']
  /** Card ids of the open pages in reading order, "" for an empty pocket. */
  const cards = () =>
    page.getByTestId('pocket').evaluateAll((pockets) => pockets.map((entry) => entry.getAttribute('data-card-id')))
  for (const [index, id] of ids.entries()) {
    const found = tile(page, id)
    await found.scrollIntoViewIfNeeded()
    await drag(page, found, pocket(page, 1, index + 1))
    await expect(pocket(page, 1, index + 1)).toHaveAttribute('data-card-id', id)
  }
  const insert = page.getByRole('button', { name: 'Lücke einfügen' })
  const close = page.getByRole('button', { name: 'Lücke schließen' })

  // an empty pocket is a gap already; with nothing behind it there is nothing to close
  await pocket(page, 1, 4).click()
  await expect(insert).toBeDisabled()
  await expect(close).toBeDisabled()

  // room at the second pocket: its card and the one behind it move on
  await pocket(page, 1, 2).click()
  await expect(close).toBeDisabled()
  await insert.click()
  await expect.poll(cards).toEqual([ids[0], '', ids[1], ids[2]])
  // the pocket stays selected, ready for the card that goes in between, or to close the gap again
  await expect(pocket(page, 1, 2)).toHaveAttribute('aria-pressed', 'true')
  await expect(insert).toBeDisabled()
  await close.click()
  await expect.poll(cards).toEqual([ids[0], ids[1], ids[2], ''])

  // at the front of a full page the last card goes over to a new page
  await pocket(page, 1, 4).click()
  await drag(page, tile(page, ids[0] ?? ''), pocket(page, 1, 4))
  await expect(pocket(page, 1, 4)).toHaveAttribute('data-card-id', ids[0] ?? '')
  await pocket(page, 1, 1).click()
  await insert.click()
  await expect.poll(cards).toEqual(['', ids[0], ids[1], ids[2]])
  await expect(page.getByTestId('mini-page')).toHaveCount(2)
  await page.getByRole('button', { name: 'Weiterblättern' }).click()
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', ids[0] ?? '')

  // one step back takes all of it back, the added page included
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(page.getByTestId('mini-page')).toHaveCount(1)
  await expect.poll(cards).toEqual([ids[0], ids[1], ids[2], ids[0]])

  // while cards are ticked off nothing is moved
  await pocket(page, 1, 1).click()
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await expect(insert).toHaveCount(0)
})

test('several pockets are selected together and moved, marked and emptied as one', async ({ page }) => {
  await createBinder(page, 'Mehrere')
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const ids = ['sv03.5-001', 'sv03.5-002', 'sv03.5-003']
  for (const [index, id] of ids.entries()) {
    await drag(page, tile(page, id), pocket(page, 1, index + 1))
    await expect(pocket(page, 1, index + 1)).toHaveAttribute('data-card-id', id)
  }
  /** Card ids of the page in reading order, "" for an empty pocket. */
  const cards = () =>
    page.getByTestId('pocket').evaluateAll((pockets) => pockets.map((entry) => entry.getAttribute('data-card-id')))
  const selected = () =>
    page
      .getByTestId('pocket')
      .evaluateAll((pockets) => pockets.flatMap((entry, index) => (entry.getAttribute('aria-pressed') === 'true' ? [index + 1] : [])))
  const panel = page.getByTestId('multi-selection')

  // Ctrl adds a pocket to the selection and takes it out again
  await pocket(page, 1, 1).click()
  await expect(panel).toHaveCount(0)
  await pocket(page, 1, 2).click({ modifiers: ['ControlOrMeta'] })
  await expect.poll(selected).toEqual([1, 2])
  await expect(panel).toContainText('2 Pockets ausgewählt, 2 Karten')
  // the details of a single card make room for what can be done with all
  await expect(page.getByTestId('selected-rarity')).toHaveCount(0)
  await pocket(page, 1, 2).click({ modifiers: ['ControlOrMeta'] })
  await expect.poll(selected).toEqual([1])
  await expect(panel).toHaveCount(0)

  // Shift takes everything from the pocket selected last to the one clicked
  await pocket(page, 1, 3).click({ modifiers: ['Shift'] })
  await expect.poll(selected).toEqual([1, 2, 3])
  await expect(panel).toContainText('3 Pockets ausgewählt, 3 Karten')

  // one of them dragged two pockets on: all three go along
  await drag(page, pocket(page, 1, 1), pocket(page, 1, 3))
  await expect.poll(cards).toEqual(['', '', ids[0], ids[1], ids[2], '', '', '', ''])
  await expect.poll(selected).toEqual([3, 4, 5])

  // past the end of the binder they do not fit: nothing moves, and a word says why
  await drag(page, pocket(page, 1, 3), pocket(page, 1, 9))
  await expect(page.getByRole('alert')).toHaveText(/passen die ausgewählten Karten nicht/)
  await expect.poll(cards).toEqual(['', '', ids[0], ids[1], ids[2], '', '', '', ''])

  // all marked as missing, and as there again
  await panel.getByRole('button', { name: 'Alle fehlen' }).click()
  await expect(page.locator('[data-testid="pocket"][data-owned="false"]')).toHaveCount(3)
  await panel.getByRole('button', { name: 'Alle vorhanden' }).click()
  await expect(page.locator('[data-testid="pocket"][data-owned="true"]')).toHaveCount(3)

  // a plain click selects one pocket again
  await pocket(page, 1, 4).click()
  await expect.poll(selected).toEqual([4])
  await expect(panel).toHaveCount(0)

  // without a keyboard: the mode in which every click adds or removes a pocket
  const mode = page.getByRole('button', { name: 'Mehrere auswählen' })
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  await pocket(page, 1, 3).click()
  await pocket(page, 1, 9).click()
  await expect.poll(selected).toEqual([3, 4, 9])
  await expect(panel).toContainText('3 Pockets ausgewählt, 2 Karten')
  await mode.click()

  // emptied together, by button or by the Delete key; one step back brings them all
  await panel.getByRole('button', { name: 'Pockets leeren' }).click()
  await expect.poll(cards).toEqual(['', '', '', '', ids[2], '', '', '', ''])
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(cards).toEqual(['', '', ids[0], ids[1], ids[2], '', '', '', ''])
  await pocket(page, 1, 3).click()
  await pocket(page, 1, 5).click({ modifiers: ['Shift'] })
  await page.keyboard.press('Delete')
  await expect.poll(cards).toEqual(['', '', '', '', '', '', '', '', ''])

  // "Auswahl aufheben" and Escape let go of the selection
  await expect.poll(selected).toEqual([3, 4, 5])
  await page.keyboard.press('Escape')
  await expect.poll(selected).toEqual([])
  await pocket(page, 1, 1).click()
  await pocket(page, 1, 2).click({ modifiers: ['ControlOrMeta'] })
  await panel.getByRole('button', { name: 'Auswahl aufheben' }).click()
  await expect.poll(selected).toEqual([])

  // while cards are ticked off a click keeps its meaning there
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await expect(mode).toHaveCount(0)
})
