import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from './fixtures'
import { makePng, pngFile } from './png'

const forest = pngFile('wald.png', makePng(600, 300, [20, 120, 40], [200, 230, 90]))
const sunset = pngFile('abend.png', makePng(300, 300, [230, 90, 30]))

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

/** Parts of placed images on a page; an image across the rings has one part per page. */
function imagesOn(page: Page, pageNumber: number): Locator {
  return page.getByRole('region', { name: `Seite ${pageNumber}`, exact: true }).getByTestId('placed-image')
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

/** Uploads a file through "Bild hinzufügen" behind the given pocket. */
async function addImage(page: Page, pageNumber: number, position: number, file = forest) {
  await pocket(page, pageNumber, position).click()
  await page.getByLabel('Bild hinzufügen').setInputFiles(file)
  await expect(pocket(page, pageNumber, position)).toHaveAttribute('data-over-image', 'true')
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Element is not visible')
  return bounds
}

const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')
const loaded = (image: Locator) =>
  expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('an image over three pockets with a card on top survives export and re-import', async ({ page }) => {
  await createBinder(page, 'Michi')

  // upload into the library and drag it behind the middle row
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  await page.getByLabel('Bilddateien auswählen').setInputFiles(forest)
  const libraryImage = page.getByTestId('library-image')
  await expect(libraryImage).toHaveCount(1)
  await drag(page, libraryImage.locator('img'), pocket(page, 1, 4))
  await expect(imagesOn(page, 1)).toHaveCount(1)

  await page.getByLabel('Breite').selectOption('3')
  const image = await box(imagesOn(page, 1))
  const first = await box(pocket(page, 1, 4))
  const last = await box(pocket(page, 1, 6))
  expect(image.x).toBeCloseTo(first.x, 0)
  expect(image.x + image.width).toBeCloseTo(last.x + last.width, 0)
  expect(image.height).toBeCloseTo(first.height, 0)
  for (const position of [4, 5, 6]) {
    await expect(pocket(page, 1, position)).toHaveAttribute('data-over-image', 'true')
  }
  await expect(pocket(page, 1, 3)).toHaveAttribute('data-over-image', 'false')

  // a card goes on top; the image stays where it is
  await page.getByRole('tab', { name: 'Karten' }).click()
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  await drag(page, page.locator('[data-card-id="sv03.5-006"] img'), pocket(page, 1, 5))
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(imagesOn(page, 1)).toHaveCount(1)
  await saved(page)

  // export, wipe everything, import again
  await page.getByRole('button', { name: 'Backup' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Als JSON exportieren' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
    binder: { pages: { images: unknown[] }[] }
    assets: { mimeType: string; width: number; height: number }[]
  }
  expect(backup.binder.pages[0]?.images).toHaveLength(1)
  expect(backup.assets).toMatchObject([{ mimeType: 'image/png', width: 600, height: 300 }])

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('pokebinder')
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error('could not delete the database'))
        request.onblocked = () => resolve()
      }),
  )
  await page.reload()
  await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  await expect(page.getByTestId('library-image')).toHaveCount(0)

  await page.getByLabel('Backup-Datei auswählen').setInputFiles(backupPath)
  await expect(page.getByRole('heading', { name: 'Michi' })).toBeVisible()
  await expect(imagesOn(page, 1)).toHaveCount(1)
  await loaded(imagesOn(page, 1).locator('img'))
  expect((await box(imagesOn(page, 1))).width).toBeCloseTo(image.width, 0)
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(page.getByTestId('library-image')).toHaveCount(1)
})

test('an image can be any width and height in pockets, or the whole page', async ({ page }) => {
  await createBinder(page, 'Größen')
  await addImage(page, 1, 1)
  const pocketBox = await box(pocket(page, 1, 1))
  const gap = (await box(pocket(page, 1, 2))).x - pocketBox.x - pocketBox.width

  // 2 wide, 1 high
  await page.getByLabel('Breite').selectOption('2')
  let image = await box(imagesOn(page, 1))
  expect(image.width).toBeCloseTo(pocketBox.width * 2 + gap, 0)
  expect(image.height).toBeCloseTo(pocketBox.height, 0)

  // 2 wide, 3 high
  await page.getByLabel('Höhe').selectOption('3')
  image = await box(imagesOn(page, 1))
  expect(image.height).toBeCloseTo(pocketBox.height * 3 + gap * 2, 0)

  // on page 1 an image cannot be wider than the page
  await expect(page.getByLabel('Breite').locator('option')).toHaveText(['1 Pocket', '2 Pockets', '3 Pockets'])

  await page.getByRole('button', { name: 'Ganze Seite' }).click()
  await expect(page.getByLabel('Breite')).toHaveValue('3')
  await expect(page.getByLabel('Höhe')).toHaveValue('3')
  await expect(page.locator('[data-testid="pocket"][data-over-image="true"]')).toHaveCount(9)
})

test('on a double page an image can reach across the rings, 6 wide and 1 high', async ({ page }) => {
  await createBinder(page, 'Panorama', 3)
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
  await addImage(page, 2, 4)

  await expect(page.getByLabel('Breite').locator('option')).toHaveCount(6)
  await page.getByLabel('Breite').selectOption('6')

  // one part per page, each as wide as the page's three pockets
  await expect(imagesOn(page, 2)).toHaveCount(1)
  await expect(imagesOn(page, 3)).toHaveCount(1)
  const leftPart = await box(imagesOn(page, 2))
  const rightPart = await box(imagesOn(page, 3))
  expect(leftPart.x).toBeCloseTo((await box(pocket(page, 2, 4))).x, 0)
  expect(rightPart.x + rightPart.width).toBeCloseTo(
    (await box(pocket(page, 3, 6))).x + (await box(pocket(page, 3, 6))).width,
    0,
  )
  expect(rightPart.width).toBeCloseTo(leftPart.width, 0)
  expect(rightPart.y).toBeCloseTo(leftPart.y, 0)

  // both parts show the same picture, laid out across all six pockets:
  // the right part continues where the left part ends
  const pictureBounds = (part: Locator) =>
    part.locator('img').evaluate((img) => {
      const frame = (img.parentElement as HTMLElement).getBoundingClientRect()
      return { left: frame.left, width: frame.width }
    })
  const leftPicture = await pictureBounds(imagesOn(page, 2))
  const rightPicture = await pictureBounds(imagesOn(page, 3))
  expect(leftPicture.width).toBeCloseTo(rightPicture.width, 0)
  expect(leftPicture.width).toBeGreaterThan(leftPart.width * 2)
  expect(leftPicture.left).toBeCloseTo(leftPart.x, 0)
  expect(rightPicture.left + rightPicture.width).toBeCloseTo(rightPart.x + rightPart.width, 0)

  // selecting a pocket on the right page reaches the same image
  await pocket(page, 3, 5).click()
  await expect(page.getByLabel('Breite')).toHaveValue('6')
  await saved(page)
  await page.reload()
  await page.getByRole('button', { name: 'Weiterblättern' }).click()
  await expect(imagesOn(page, 2)).toHaveCount(1)
  await expect(imagesOn(page, 3)).toHaveCount(1)
})

test('deleting a page cuts an image across two pages back to its own page', async ({ page }) => {
  await createBinder(page, 'Kürzen', 5)
  await page.getByRole('button', { name: 'Zurückblättern' }).click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
  await addImage(page, 2, 1)
  await page.getByLabel('Breite').selectOption('5')
  await expect(imagesOn(page, 3)).toHaveCount(1)

  // without page 3, page 4 faces page 2; it has no image of its own, so the image may stay wide
  await page.getByRole('button', { name: 'Seite 3 löschen' }).click()
  await expect(imagesOn(page, 3)).toHaveCount(1)

  // on page 1 the same image could not be this wide: move the page there by deleting page 1
  await page.getByRole('button', { name: 'Zurückblättern' }).click()
  await page.getByRole('button', { name: 'Seite 1 löschen' }).click()
  await expect(imagesOn(page, 1)).toHaveCount(1)
  await pocket(page, 1, 1).click()
  await expect(page.getByLabel('Breite')).toHaveValue('3')
})

test('images may not overlap', async ({ page }) => {
  await createBinder(page, 'Überlappung')
  await addImage(page, 1, 1)
  await addImage(page, 1, 3, sunset)
  await expect(imagesOn(page, 1)).toHaveCount(2)

  // growing into the other image is refused and changes nothing
  await pocket(page, 1, 1).click()
  await page.getByLabel('Breite').selectOption('3')
  await expect(page.getByRole('alert')).toHaveText('Dort liegt schon ein anderes Bild.')
  await expect(page.getByLabel('Breite')).toHaveValue('1')

  await page.getByLabel('Breite').selectOption('2')
  await expect(page.getByRole('alert')).toHaveCount(0)

  // a library image dropped on a covered pocket is refused as well
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  await drag(page, page.getByTestId('library-image').first().locator('img'), pocket(page, 1, 2))
  await expect(page.getByRole('alert')).toHaveText('Dort liegt schon ein anderes Bild.')
  await expect(imagesOn(page, 1)).toHaveCount(2)
})

test('an image is moved by dragging it to other pockets, also to the facing page', async ({ page }) => {
  await createBinder(page, 'Verschieben', 3)
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
  const covered = (pageNumber: number) =>
    page
      .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
      .getByTestId('pocket')
      .evaluateAll((pockets) =>
        pockets.flatMap((entry, index) => (entry.getAttribute('data-over-image') === 'true' ? [index + 1] : [])),
      )

  // two pockets wide, in the top left corner of page 2
  await addImage(page, 2, 1)
  await page.getByLabel('Breite').selectOption('2')
  await expect.poll(() => covered(2)).toEqual([1, 2])

  // grabbed at its right pocket and dropped one to the right and one down
  await drag(page, pocket(page, 2, 2), pocket(page, 2, 6))
  await expect.poll(() => covered(2)).toEqual([5, 6])
  await expect(page.getByLabel('Breite')).toHaveValue('2')
  await expect(page.getByRole('alert')).toHaveCount(0)

  // its left pocket on the last pocket of page 3: the right one would hang over the edge of
  // the binder. It stays where it was, with a word why.
  await drag(page, pocket(page, 2, 5), pocket(page, 3, 9))
  await expect(page.getByRole('alert')).toHaveText('So groß passt das Bild dort nicht hin.')
  await expect.poll(() => covered(2)).toEqual([5, 6])
  await expect.poll(() => covered(3)).toEqual([])

  // onto the facing page
  await drag(page, pocket(page, 2, 5), pocket(page, 3, 7))
  await expect.poll(() => covered(2)).toEqual([])
  await expect.poll(() => covered(3)).toEqual([7, 8])
  await expect(imagesOn(page, 3)).toHaveCount(1)

  // not onto another image
  await addImage(page, 3, 2, sunset)
  await drag(page, pocket(page, 3, 7), pocket(page, 3, 1))
  await expect(page.getByRole('alert')).toHaveText('Dort liegt schon ein anderes Bild.')
  await expect.poll(() => covered(3)).toEqual([2, 7, 8])

  // a card on the image is what gets dragged there; the image stays
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  const tile = page.getByTestId('card-tile').first()
  await expect(tile).toBeVisible()
  await drag(page, tile.locator('> div'), pocket(page, 3, 7))
  await expect(pocket(page, 3, 7)).not.toHaveAttribute('data-card-id', '')
  await drag(page, pocket(page, 3, 7), pocket(page, 3, 4))
  await expect(pocket(page, 3, 4)).not.toHaveAttribute('data-card-id', '')
  await expect.poll(() => covered(3)).toEqual([2, 7, 8])

  // moving is undone like any other change, and it is stored
  await drag(page, pocket(page, 3, 8), pocket(page, 3, 9))
  await expect.poll(() => covered(3)).toEqual([2, 8, 9])
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(() => covered(3)).toEqual([2, 7, 8])
  await page.getByRole('button', { name: 'Wiederholen' }).click()
  await saved(page)
  await page.reload()
  // the binder opens on page 1 again
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 1')
  await page.getByRole('button', { name: 'Weiterblättern' }).click()
  await expect.poll(() => covered(3)).toEqual([2, 8, 9])
})

test('own images are printed in true size: a PDF with a piece per page side', async ({ page }) => {
  await createBinder(page, 'Druck', 3)
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 2 – 3')
  const printEntry = page.getByRole('menuitem', { name: 'Eigene Bilder drucken (PDF)' })

  // nothing to print yet
  await page.getByRole('button', { name: 'Als PNG' }).click()
  await expect(page.getByRole('menuitem', { name: 'Seite 2', exact: true })).toBeVisible()
  await expect(printEntry).toHaveCount(0)
  await page.keyboard.press('Escape')

  // one image across the rings (last pocket of the row on page 2, first on page 3), one single
  await addImage(page, 2, 3)
  await page.getByLabel('Breite').selectOption('2')
  await addImage(page, 3, 9, sunset)

  await page.getByRole('button', { name: 'Als PNG' }).click()
  const downloadPromise = page.waitForEvent('download')
  await printEntry.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^bilder-druck-[0-9]{4}-[0-9]{2}-[0-9]{2}[.]pdf$/)
  const file = await download.path()
  if (process.env.SHOT_DIR) await download.saveAs(`${process.env.SHOT_DIR}/image-print.pdf`)

  const pdf = await PDFDocument.load(await readFile(file))
  expect(pdf.getTitle()).toBe('Bilder – Druck')
  // three pieces of one pocket each share a single A4 sheet
  expect(pdf.getPageCount()).toBe(1)
  const { width, height } = pdf.getPage(0).getSize()
  expect([Math.round((width * 25.4) / 72), Math.round((height * 25.4) / 72)]).toEqual([210, 297])
  const pictures = pdf.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object.toString().includes('/Subtype /Image'))
  expect(pictures).toHaveLength(3)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the visible part of an image can be moved and magnified', async ({ page }) => {
  await createBinder(page, 'Ausschnitt')
  await addImage(page, 1, 1)
  const picture = imagesOn(page, 1).locator('img')
  await expect(picture).toHaveCSS('object-position', '50% 50%')

  await page.getByRole('button', { name: 'Ausschnitt anpassen' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ausschnitt anpassen' })
  const preview = await box(dialog.getByTestId('crop-preview'))
  await page.mouse.move(preview.x + preview.width / 2, preview.y + preview.height / 2)
  await page.mouse.down()
  await page.mouse.move(preview.x + preview.width, preview.y + preview.height / 2, { steps: 5 })
  await page.mouse.up()
  await dialog.getByLabel('Vergrößerung').fill('2')

  // nothing changes in the binder until the crop is applied
  await expect(picture).toHaveCSS('object-position', '50% 50%')
  await dialog.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(dialog).toBeHidden()

  // dragged half the preview to the right: the focus moves to the left edge
  await expect(picture).toHaveCSS('object-position', '0% 50%')
  await expect(picture).toHaveCSS('transform', 'matrix(2, 0, 0, 2, 0, 0)')

  await saved(page)
  await page.reload()
  await expect(imagesOn(page, 1).locator('img')).toHaveCSS('object-position', '0% 50%')

  // cancelling keeps the stored crop
  await pocket(page, 1, 1).click()
  await page.getByRole('button', { name: 'Ausschnitt anpassen' }).click()
  await page.getByRole('button', { name: 'Zurücksetzen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  await expect(imagesOn(page, 1).locator('img')).toHaveCSS('object-position', '0% 50%')
})

test('an image is removed from the page but stays in the library until deleted there', async ({ page }) => {
  await createBinder(page, 'Entfernen')
  await addImage(page, 1, 1)
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  const libraryImage = page.getByTestId('library-image')
  await expect(libraryImage).toHaveCount(1)
  await saved(page)

  // still used by the binder: the library keeps it
  await libraryImage.hover()
  await page.getByRole('button', { name: 'Eigenes Bild 1 löschen' }).click()
  await expect(page.getByTestId('column-left').getByRole('alert')).toContainText('wird noch in einem Binder verwendet')
  await expect(libraryImage).toHaveCount(1)

  await pocket(page, 1, 1).click()
  await page.getByRole('button', { name: 'Bild entfernen' }).click()
  await expect(imagesOn(page, 1)).toHaveCount(0)
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'false')
  await expect(libraryImage).toHaveCount(1)

  await libraryImage.hover()
  await page.getByRole('button', { name: 'Eigenes Bild 1 löschen' }).click()
  await expect(libraryImage).toHaveCount(0)
  await page.reload()
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  await expect(page.getByTestId('library-image')).toHaveCount(0)
})

test('the cover gets its own title and picture', async ({ page }) => {
  await createBinder(page, 'Kanto Collection')
  const cover = page.getByRole('region', { name: 'Cover-Innenseite' })
  await expect(cover).toContainText('Kanto Collection')
  await expect(cover.getByTestId('cover-image')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cover bearbeiten' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cover bearbeiten' })
  await dialog.getByLabel('Titel').fill('Meine ersten 151')
  await dialog.getByLabel('Cover-Bild auswählen').setInputFiles(sunset)
  await expect(dialog.locator('img')).toBeVisible()
  await dialog.getByRole('button', { name: 'Speichern' }).click()

  await expect(cover).toContainText('Meine ersten 151')
  await loaded(cover.getByTestId('cover-image'))
  // the binder keeps its name; only the cover title changed
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()

  await saved(page)
  await page.reload()
  await expect(cover).toContainText('Meine ersten 151')
  await loaded(cover.getByTestId('cover-image'))

  // on the shelf of "Meine Binder" the binder shows that picture, others their cover title
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Ohne Cover')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  const withPicture = page.getByRole('button', { name: 'Kanto Collection öffnen' })
  await loaded(withPicture.getByTestId('binder-cover-image'))
  const plain = page.getByRole('button', { name: 'Ohne Cover öffnen' })
  await expect(plain.getByTestId('binder-cover-image')).toHaveCount(0)
  await expect(plain.getByTestId('binder-cover')).toHaveText('Ohne Cover')
  // the binders stand next to each other, not below each other
  const [first, second] = await Promise.all(
    [0, 1].map((index) => page.getByTestId('binder-tile').nth(index).boundingBox()),
  )
  expect(first?.y).toBe(second?.y)
  // the cover opens the binder
  await withPicture.getByTestId('binder-cover').click()
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()

  await page.getByRole('button', { name: 'Cover bearbeiten' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Bild entfernen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click()
  await expect(cover.getByTestId('cover-image')).toHaveCount(0)
})

test('large photos are scaled down to 2000 px, other files are refused', async ({ page }) => {
  await page.getByRole('tab', { name: 'Eigene Bilder' }).click()
  await expect(page.getByText('Noch keine eigenen Bilder.')).toBeVisible()

  await page.getByLabel('Bilddateien auswählen').setInputFiles(pngFile('riesig.png', makePng(2600, 1300, [10, 60, 200])))
  const picture = page.getByTestId('library-image').locator('img')
  await loaded(picture)
  expect(await picture.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([2000, 1000])

  await page.getByLabel('Bilddateien auswählen').setInputFiles({
    name: 'notizen.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('kein Bild'),
  })
  await expect(page.getByTestId('column-left').getByRole('alert')).toHaveText(
    'Die Datei ist kein Bild im Format JPG, PNG oder WebP.',
  )
  await expect(page.getByTestId('library-image')).toHaveCount(1)

  // a file that only claims to be a picture
  await page.getByLabel('Bilddateien auswählen').setInputFiles(pngFile('kaputt.png', Buffer.from('not a png')))
  await expect(page.getByTestId('column-left').getByRole('alert')).toHaveText(
    'Die Datei ist kein Bild im Format JPG, PNG oder WebP.',
  )
  await expect(page.getByTestId('library-image')).toHaveCount(1)
})

test('an image is also moved pocket by pocket with arrows, cards on it or not', async ({ page }) => {
  await createBinder(page, 'Pfeile')
  const covered = () =>
    page
      .getByTestId('pocket')
      .evaluateAll((pockets) =>
        pockets.flatMap((entry, index) => (entry.getAttribute('data-over-image') === 'true' ? [index + 1] : [])),
      )
  const arrow = (direction: string) => page.getByRole('button', { name: `Bild nach ${direction}`, exact: true })

  // an image behind the first pocket, with a card on it: it cannot be grabbed there
  await addImage(page, 1, 1)
  await page.getByRole('tab', { name: 'Karten' }).click()
  await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
  const card = page.locator('[data-testid="card-tile"][data-card-id="sv03.5-006"] > div')
  await drag(page, card, pocket(page, 1, 1))
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect.poll(covered).toEqual([1])

  // at the top left corner beside the cover there is no way left or up
  await pocket(page, 1, 1).click()
  await expect(arrow('links')).toBeDisabled()
  await expect(arrow('oben')).toBeDisabled()

  // one pocket to the right: the image goes, the card stays, the selection follows the image
  await arrow('rechts').click()
  await expect.poll(covered).toEqual([2])
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  await expect(pocket(page, 1, 2)).toHaveAttribute('aria-pressed', 'true')
  // and on: down, then back to the left
  await arrow('unten').click()
  await expect.poll(covered).toEqual([5])
  await arrow('links').click()
  await expect.poll(covered).toEqual([4])
  await expect(pocket(page, 1, 4)).toHaveAttribute('aria-pressed', 'true')

  // two pockets wide it does not fit one further to the right: it stays, with a word why
  await page.getByLabel('Breite').selectOption('2')
  await expect.poll(covered).toEqual([4, 5])
  await arrow('rechts').click()
  await expect.poll(covered).toEqual([5, 6])
  await arrow('rechts').click()
  await expect(page.getByRole('alert')).toHaveText('So groß passt das Bild dort nicht hin.')
  await expect.poll(covered).toEqual([5, 6])

  // every step can be taken back
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(covered).toEqual([4, 5])
})
