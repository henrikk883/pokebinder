import { readFile } from 'node:fs/promises'
import type { Download, Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { makePng, pngFile } from './png'

async function createBinder(page: Page, name: string, pages = 1) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  for (let i = 1; i < pages; i++) await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
}

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

/** Shows the set "151" in the search and returns the tile of one of its cards. */
async function show151(page: Page) {
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(page.getByTestId('card-tile')).toHaveCount(207)
}
const tile = (page: Page, cardId: string) =>
  page.locator(`[data-testid="card-tile"][data-card-id="${cardId}"] > div`)

async function exportPng(page: Page, entry: string): Promise<Download> {
  await page.getByRole('button', { name: 'Als PNG' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: entry }).click()
  return downloadPromise
}

/** Width and height from the header of a PNG file. */
async function pngSize(download: Download): Promise<{ width: number; height: number; bytes: number }> {
  const file = await readFile(await download.path())
  expect(file.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20), bytes: file.length }
}

/** Colour of one point of a downloaded image, given as fractions of its width and height. */
async function pixelOf(page: Page, download: Download, x: number, y: number): Promise<number[]> {
  const base64 = (await readFile(await download.path())).toString('base64')
  return page.evaluate(
    async ([data, fx, fy]) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no canvas')
      context.drawImage(image, 0, 0)
      const point = context.getImageData(Math.round(canvas.width * fx), Math.round(canvas.height * fy), 1, 1)
      return [...point.data.slice(0, 3)]
    },
    [base64, x, y] as const,
  )
}

const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test.describe('PNG export', () => {
  test('the double page is exported 3000 px wide, whatever the zoom', async ({ page }) => {
    await createBinder(page, 'Kanto Collection', 3)
    await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
    await show151(page)
    await drag(page, tile(page, 'sv03.5-001'), pocket(page, 2, 1))
    await expect(pocket(page, 2, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

    const first = await exportPng(page, 'Doppelseite')
    expect(first.suggestedFilename()).toBe('kanto-collection-seiten-2-3.png')
    const atDefaultZoom = await pngSize(first)
    expect(atDefaultZoom.width).toBe(3000)
    expect(atDefaultZoom.height).toBeGreaterThan(1500)
    expect(atDefaultZoom.bytes).toBeGreaterThan(10_000)

    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Vergrößern' }).click()
    await expect(page.getByTestId('zoom-value')).toHaveText('110 %')
    const zoomed = await pngSize(await exportPng(page, 'Doppelseite'))
    expect(zoomed.width).toBe(3000)
    expect(Math.abs(zoomed.height - atDefaultZoom.height)).toBeLessThan(40)
  })

  test('a single page is exported with its own image and cards, without buttons or selection', async ({ page }) => {
    await createBinder(page, 'Einzelseite', 3)
    // an orange image behind the whole of page 2
    await pocket(page, 2, 1).click()
    await page.getByLabel('Bild hinzufügen').setInputFiles(pngFile('orange.png', makePng(300, 300, [230, 90, 30])))
    await page.getByRole('button', { name: 'Ganze Seite' }).click()
    await expect(page.locator('[data-testid="pocket"][data-over-image="true"]')).toHaveCount(9)
    // the pocket stays selected: the export must not show the violet frame around it
    await expect(pocket(page, 2, 1)).toHaveAttribute('aria-pressed', 'true')

    const download = await exportPng(page, 'Nur Seite 2')
    expect(download.suggestedFilename()).toBe('einzelseite-seite-2.png')
    const size = await pngSize(download)
    expect(size.width).toBe(1500)

    // the middle of the first row lies inside a pocket, on top of the image
    const [red, green, blue] = await pixelOf(page, download, 0.5, 0.2)
    expect(red).toBeGreaterThan(200)
    expect(green).toBeGreaterThan(60)
    expect(green).toBeLessThan(120)
    expect(blue).toBeLessThan(70)

    // the caption stays, the delete button next to it does not: the bottom right is plain background
    const corner = await pixelOf(page, download, 0.97, 0.985)
    expect(Math.max(...corner)).toBeLessThan(60)
    await expect(pocket(page, 2, 1)).toHaveAttribute('aria-pressed', 'false')
  })

  test('page 1 is exported next to the cover', async ({ page }) => {
    await createBinder(page, 'Deckblatt')

    await page.getByRole('button', { name: 'Als PNG' }).click()
    // only what lies open is offered
    await expect(page.getByRole('menuitem')).toHaveText(['Doppelseite', 'Nur Seite 1'])
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Doppelseite' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('deckblatt-seite-1.png')
    expect((await pngSize(download)).width).toBe(3000)
  })
})

test.describe('undo and redo', () => {
  test('placing a card can be taken back and brought back, by button and by keyboard', async ({ page }) => {
    await createBinder(page, 'Verlauf')
    const undo = page.getByRole('button', { name: 'Rückgängig' })
    const redo = page.getByRole('button', { name: 'Wiederholen' })
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()

    await show151(page)
    await drag(page, tile(page, 'sv03.5-001'), pocket(page, 1, 1))
    await drag(page, tile(page, 'sv03.5-002'), pocket(page, 1, 2))
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', 'sv03.5-002')
    await expect(undo).toBeEnabled()

    await undo.click()
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', '')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')
    await expect(redo).toBeEnabled()

    await redo.click()
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', 'sv03.5-002')
    await expect(redo).toBeDisabled()

    // Ctrl+Z twice empties the page, Ctrl+Y and Ctrl+Shift+Z fill it again
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', '')
    await expect(undo).toBeDisabled()
    await page.keyboard.press('Control+y')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')
    await page.keyboard.press('Control+Shift+z')
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', 'sv03.5-002')
  })

  test('what is undone is also what is stored; after a reload the history starts afresh', async ({ page }) => {
    await createBinder(page, 'Gespeichert')
    await show151(page)
    await drag(page, tile(page, 'sv03.5-001'), pocket(page, 1, 1))
    await drag(page, tile(page, 'sv03.5-002'), pocket(page, 1, 2))
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', 'sv03.5-002')

    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', '')
    await saved(page)
    await page.reload()

    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', '')
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Wiederholen' })).toBeDisabled()
  })

  test('marking, moving, sorting, pages and images are all covered', async ({ page }) => {
    await createBinder(page, 'Alles')
    await show151(page)
    await drag(page, tile(page, 'sv03.5-005'), pocket(page, 1, 3))
    await expect(pocket(page, 1, 3)).toHaveAttribute('data-card-id', 'sv03.5-005')

    // 1 mark as missing, 2 move, 3 add a page, 4 place an image
    await pocket(page, 1, 3).hover()
    await pocket(page, 1, 3).getByRole('button', { name: 'Als fehlend markieren' }).click()
    await expect(pocket(page, 1, 3)).toHaveAttribute('data-owned', 'false')
    await drag(page, pocket(page, 1, 3), pocket(page, 1, 9))
    await expect(pocket(page, 1, 9)).toHaveAttribute('data-card-id', 'sv03.5-005')
    await page.getByRole('button', { name: 'Seite hinzufügen' }).click()
    await expect(page.getByTestId('spread-label')).toHaveText('Seite 2')
    await page.getByRole('button', { name: 'Zurückblättern' }).click()
    await pocket(page, 1, 1).click()
    await page.getByLabel('Bild hinzufügen').setInputFiles(pngFile('bild.png', makePng(200, 200, [20, 120, 40])))
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'true')

    const undo = page.getByRole('button', { name: 'Rückgängig' })
    await undo.click() // the image
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'false')
    await undo.click() // the page
    await expect(page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button')).toHaveCount(1)
    await undo.click() // the move
    await expect(pocket(page, 1, 3)).toHaveAttribute('data-card-id', 'sv03.5-005')
    await expect(pocket(page, 1, 9)).toHaveAttribute('data-card-id', '')
    await expect(pocket(page, 1, 3)).toHaveAttribute('data-owned', 'false')
    await undo.click() // the marking
    await expect(pocket(page, 1, 3)).toHaveAttribute('data-owned', 'true')

    const redo = page.getByRole('button', { name: 'Wiederholen' })
    for (let i = 0; i < 4; i++) await redo.click()
    await expect(pocket(page, 1, 9)).toHaveAttribute('data-owned', 'false')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'true')
    await expect(redo).toBeDisabled()
  })

  test('typing in the search field keeps its own undo', async ({ page }) => {
    await createBinder(page, 'Tippen')
    await show151(page)
    await drag(page, tile(page, 'sv03.5-001'), pocket(page, 1, 1))
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')

    const search = page.getByRole('searchbox', { name: 'Name, Set oder Nummer' })
    await search.fill('Bisa')
    await search.press('Control+z')

    // the card is still there: Ctrl+Z belonged to the text field
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')
  })
})
