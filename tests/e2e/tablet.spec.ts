import type { CDPSession, Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// An iPad in landscape: no mouse, fingers only, and too narrow for three columns.
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

let cdp: CDPSession

async function centre(locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Element is not visible')
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

const finger = (type: string, points: { x: number; y: number }[]) =>
  cdp.send('Input.dispatchTouchEvent', {
    type: type as 'touchStart',
    touchPoints: points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
  })

/** Moves a finger from one point to another; `holdMs` is how long it rests before it moves. */
async function fingerPath(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  holdMs: number,
) {
  await finger('touchStart', [from])
  if (holdMs > 0) await page.waitForTimeout(holdMs)
  const steps = 12
  for (let step = 1; step <= steps; step++) {
    await finger('touchMove', [
      { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps },
    ])
    await page.waitForTimeout(16)
  }
  await finger('touchEnd', [])
}

/** Holds a finger on `from` until it is picked up, then carries it to `to`. */
async function holdAndDrag(page: Page, from: Locator, to: Locator) {
  await fingerPath(page, await centre(from), await centre(to), 450)
}

function pocket(page: Page, pageNumber: number, position: number): Locator {
  return page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .nth(position - 1)
}

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).tap()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).tap()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

async function searchFor(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill(text)
  await expect(page.getByTestId('card-tile').first()).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  cdp = await page.context().newCDPSession(page)
  // what a tablet tells the page: nothing can hover, and what points is coarse
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'hover', value: 'none' },
      { name: 'pointer', value: 'coarse' },
    ],
  })
  await page.goto('/')
})

test('the right column is folded away and comes over the binder at the push of its tab', async ({ page }) => {
  await createBinder(page, 'Tablet')
  const right = page.getByTestId('column-right')
  await expect(right).toBeHidden()
  // the binder has the room of two columns
  const centreBox = await page.getByTestId('column-center').boundingBox()
  expect(centreBox?.width).toBeCloseTo(1180 - 300, 0)

  await pocket(page, 1, 1).tap()
  await expect(pocket(page, 1, 1)).toHaveAttribute('aria-pressed', 'true')
  await expect(right).toBeHidden()

  await page.getByRole('button', { name: 'Auswahl einblenden' }).tap()
  await expect(right).toBeVisible()
  await expect(right.getByRole('button', { name: 'Pocket leeren' })).toBeVisible()
  const rightBox = await right.boundingBox()
  expect(rightBox?.width).toBeCloseTo(300, 0)
  expect((rightBox?.x ?? 0) + (rightBox?.width ?? 0)).toBeCloseTo(1180, 0)

  await page.getByRole('button', { name: 'Auswahl ausblenden' }).tap()
  await expect(right).toBeHidden()
})

test('a card is picked up by holding a finger on it and dropped into a pocket', async ({ page }) => {
  await createBinder(page, 'Finger')
  await searchFor(page, 'Glurak')
  const tile = page.getByTestId('card-tile').first()
  const cardId = await tile.getAttribute('data-card-id')

  await holdAndDrag(page, tile.locator('> div'), pocket(page, 1, 5))
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', cardId ?? '')

  // and on to another pocket
  await holdAndDrag(page, pocket(page, 1, 5), pocket(page, 1, 9))
  await expect(pocket(page, 1, 9)).toHaveAttribute('data-card-id', cardId ?? '')
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', '')
})

test('a swipe over the search results scrolls them and picks nothing up', async ({ page }) => {
  await createBinder(page, 'Wischen')
  await searchFor(page, 'Glurak')
  const list = page.getByTestId('search-results')
  const scrolled = () => list.evaluate((element) => element.scrollTop)
  expect(await scrolled()).toBe(0)

  // from a card in the lower part of the list straight up, without resting on it
  const start = await centre(page.getByTestId('card-tile').nth(2))
  await fingerPath(page, start, { x: start.x, y: start.y - 300 }, 0)

  await expect.poll(scrolled).toBeGreaterThan(100)
  await expect(page.locator('[data-testid="pocket"]:not([data-card-id=""])')).toHaveCount(0)
})

test('a tapped card shows the button for "missing", large enough for a finger', async ({ page }) => {
  await createBinder(page, 'Tippen')
  await searchFor(page, 'Glurak')
  await holdAndDrag(page, page.getByTestId('card-tile').first().locator('> div'), pocket(page, 1, 1))
  await holdAndDrag(page, page.getByTestId('card-tile').nth(1).locator('> div'), pocket(page, 1, 2))
  await expect(pocket(page, 1, 2)).not.toHaveAttribute('data-card-id', '')

  // the drop selected pocket 2: its button shows, the one of pocket 1 does not
  const opacity = (position: number) =>
    pocket(page, 1, position)
      .getByRole('button', { name: /als fehlend|als vorhanden/i })
      .evaluate((button) => getComputedStyle(button).opacity)
  await expect.poll(() => opacity(2)).toBe('1')
  expect(await opacity(1)).toBe('0')

  await pocket(page, 1, 1).tap()
  await expect.poll(() => opacity(1)).toBe('1')
  const toggle = pocket(page, 1, 1).getByRole('button', { name: /als fehlend|als vorhanden/i })
  const size = await toggle.boundingBox()
  expect(size?.height).toBeGreaterThanOrEqual(28)

  await toggle.tap()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'false')
  await toggle.tap()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')
})

test('binders on the shelf are rearranged by finger', async ({ page }) => {
  for (const name of ['Erster', 'Zweiter']) {
    await createBinder(page, name)
    await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).tap()
  }
  const shelf = () =>
    page
      .getByTestId('binder-tile')
      .evaluateAll((tiles) => tiles.map((entry) => entry.getAttribute('data-binder-name')))
  await page.getByRole('combobox', { name: 'Sortierung' }).selectOption({ label: 'Eigene Reihenfolge' })
  await expect.poll(shelf).toEqual(['Zweiter', 'Erster'])
  // without a mouse the buttons of every binder are there all the time
  await expect(page.getByRole('button', { name: 'Erster umbenennen' })).toHaveCSS('opacity', '1')

  const tile = (name: string) => page.locator(`[data-testid="binder-tile"][data-binder-name="${name}"]`)
  await holdAndDrag(page, tile('Erster').getByTestId('binder-cover'), tile('Zweiter'))
  await expect.poll(shelf).toEqual(['Erster', 'Zweiter'])
  // letting go did not open the binder
  await expect(page.getByRole('heading', { name: 'Meine Binder' })).toBeVisible()
})

test('the search folds away too, and the binder then has the whole width', async ({ page }) => {
  await createBinder(page, 'Breite')
  const left = page.getByTestId('column-left')
  const width = async () => (await page.getByTestId('column-center').boundingBox())?.width
  await expect(left).toBeVisible()

  await page.getByRole('button', { name: 'Suche ausblenden' }).tap()
  await expect(left).toBeHidden()
  expect(await width()).toBeCloseTo(1180, 0)

  // what was typed is still there when the search comes back
  await page.getByRole('button', { name: 'Suche einblenden' }).tap()
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await page.getByRole('button', { name: 'Suche ausblenden' }).tap()
  await page.getByRole('button', { name: 'Suche einblenden' }).tap()
  await expect(page.getByRole('searchbox', { name: 'Name, Set oder Nummer' })).toHaveValue('Glurak')
  expect(await width()).toBeCloseTo(1180 - 300, 0)
})

test('the zoom adapts so that the whole binder is in view, until one is picked by hand', async ({ page }) => {
  await createBinder(page, 'Passend')
  const value = page.getByTestId('zoom-value')
  const zoom = async () => Number((await value.textContent())?.replace(' %', ''))
  /** How far the binder reaches beyond its frame, in pixels; 0 or less means all of it shows. */
  const overflow = () =>
    page.getByTestId('binder-frame').evaluate((frame) => {
      const spread = frame.firstElementChild as HTMLElement
      return Math.max(spread.offsetWidth - frame.clientWidth, spread.offsetHeight - frame.clientHeight)
    })

  // the screen is too low for the usual 80 %
  await expect(value).not.toHaveText('80 %')
  const fitted = await zoom()
  expect(fitted).toBeLessThan(80)
  expect(await overflow()).toBeLessThanOrEqual(0)
  // and it is the largest zoom that fits: one step more would not
  await page.getByRole('button', { name: 'Vergrößern' }).tap()
  expect(await zoom()).toBe(fitted + 5)
  expect(await overflow()).toBeGreaterThan(0)

  // a zoom picked by hand stays, whatever happens to the columns
  await page.getByRole('button', { name: 'Suche ausblenden' }).tap()
  await page.getByRole('button', { name: 'Suche einblenden' }).tap()
  expect(await zoom()).toBe(fitted + 5)

  // another binder starts fitted again; a higher screen gives it more room
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).tap()
  await page.getByRole('button', { name: 'Passend öffnen' }).tap()
  await expect(value).toHaveText(`${fitted} %`)
  await page.setViewportSize({ width: 1180, height: 1100 })
  await expect(value).toHaveText('80 %')
  await page.setViewportSize({ width: 1180, height: 820 })
  await expect(value).toHaveText(`${fitted} %`)
})

test('the info button of a card is there without a mouse and opens by a tap', async ({ page }) => {
  await createBinder(page, 'Info')
  await searchFor(page, 'Glurak')
  const tile = page.getByTestId('card-tile').first()
  const info = tile.getByRole('button', { name: /^Infos zu / })
  await expect(info).toHaveCSS('opacity', '1')
  expect((await info.boundingBox())?.width).toBeGreaterThanOrEqual(32)

  await info.tap()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('card-info-languages')).toBeVisible()
  // the whole window is on the screen
  const box = await dialog.boundingBox()
  expect(box?.y).toBeGreaterThanOrEqual(0)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(820)
  await dialog.getByRole('button', { name: 'Schließen' }).tap()
  await expect(dialog).toBeHidden()
})

test('pages are put in another order by finger, in the strip of thumbnails', async ({ page }) => {
  await createBinder(page, 'Reihenfolge')
  await searchFor(page, 'Glurak')
  await holdAndDrag(page, page.getByTestId('card-tile').first().locator('> div'), pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).not.toHaveAttribute('data-card-id', '')
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  await page.getByRole('button', { name: 'Seite hinzufügen' }).tap()
  const miniPage = (number: number) => page.locator(`[data-testid="mini-page"][data-page-number="${number}"]`)
  const filled = (number: number) => miniPage(number).locator('.bg-muted')
  await expect(filled(1)).toHaveCount(1)

  await holdAndDrag(page, miniPage(1), miniPage(3))
  await expect(filled(3)).toHaveCount(1)
  await expect(filled(1)).toHaveCount(0)
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')

  // a tap on a thumbnail still turns the pages
  await page.getByRole('button', { name: 'Seite 1', exact: true }).tap()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 1')
})

test('several cards are selected by taps and carried along together by finger', async ({ page }) => {
  await createBinder(page, 'Gruppe')
  await searchFor(page, 'Glurak')
  const tiles = page.getByTestId('card-tile')
  await holdAndDrag(page, tiles.nth(0).locator('> div'), pocket(page, 1, 1))
  await holdAndDrag(page, tiles.nth(1).locator('> div'), pocket(page, 1, 2))
  await expect(pocket(page, 1, 2)).not.toHaveAttribute('data-card-id', '')
  const first = await pocket(page, 1, 1).getAttribute('data-card-id')
  const second = await pocket(page, 1, 2).getAttribute('data-card-id')

  // no keys to hold on a tablet: a mode in which every tap adds a pocket
  // Pocket 2 is selected already, from the card that was just dropped there.
  await expect(pocket(page, 1, 2)).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Mehrere auswählen' }).tap()
  await pocket(page, 1, 1).tap()
  await expect(pocket(page, 1, 1)).toHaveAttribute('aria-pressed', 'true')
  await expect(pocket(page, 1, 2)).toHaveAttribute('aria-pressed', 'true')

  await holdAndDrag(page, pocket(page, 1, 1), pocket(page, 1, 7))
  await expect(pocket(page, 1, 7)).toHaveAttribute('data-card-id', first ?? '')
  await expect(pocket(page, 1, 8)).toHaveAttribute('data-card-id', second ?? '')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', '')

  // what can be done with them is in the column that folds away
  await page.getByRole('button', { name: 'Auswahl einblenden' }).tap()
  await expect(page.getByTestId('multi-selection')).toContainText('2 Pockets ausgewählt, 2 Karten')
})
