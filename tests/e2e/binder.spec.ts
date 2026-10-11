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

  let question = ''
  page.once('dialog', (dialog) => {
    question = dialog.message()
    void dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
  expect(question).toContain('Seite 2 mit allen Karten darauf löschen?')
  await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Seite 2 löschen' }).click()
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

  page.once('dialog', (dialog) => void dialog.dismiss())
  await page.getByLabel('Layout').selectOption('3x3')
  await expect(page.getByTestId('pocket')).toHaveCount(4)
  await expect(page.getByLabel('Layout')).toHaveValue('2x2')

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByLabel('Layout').selectOption('3x3')
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
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Erster Binder löschen' }).click()
  await expect(page.getByRole('button', { name: 'Erster Binder öffnen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zweiter Binder öffnen' })).toBeVisible()
})
