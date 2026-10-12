import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { makePng, pngFile } from './png'

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
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

const tile = (page: Page, cardId: string) =>
  page.locator(`[data-testid="card-tile"][data-card-id="${cardId}"] > div`)
const toList = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Meine Karten' })
const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')

async function wipeEverything(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test.describe('saving everything', () => {
  test('one file holds all binders and images and brings them back', async ({ page }) => {
    // two binders: one with a card and an image behind it, one empty; plus an unused library image
    await createBinder(page, 'Kanto')
    await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
    await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 5))
    await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
    await pocket(page, 1, 1).click()
    await page.getByLabel('Bild hinzufügen').setInputFiles(pngFile('wald.png', makePng(200, 200, [20, 120, 40])))
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'true')
    await page.getByRole('tab', { name: 'Bilder' }).click()
    await page.getByLabel('Bilddateien auswählen').setInputFiles(pngFile('lose.png', makePng(100, 100, [200, 30, 30])))
    await expect(page.getByTestId('library-image')).toHaveCount(2)
    await toList(page).click()
    await createBinder(page, 'Johto')
    await saved(page)

    await page.getByRole('button', { name: 'Backup' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /^Alles sichern/ }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^pokebinder-gesamtsicherung-\d{4}-\d{2}-\d{2}\.json$/)
    const backupPath = await download.path()
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
      format: string
      binders: { name: string }[]
      assets: unknown[]
    }
    expect(backup.format).toBe('pokebinder-full-backup')
    expect(backup.binders.map((binder) => binder.name).sort()).toEqual(['Johto', 'Kanto'])
    // also the image no binder uses
    expect(backup.assets).toHaveLength(2)

    await wipeEverything(page)
    await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()

    await page.getByLabel('Backup-Datei auswählen').setInputFiles(backupPath)

    // several binders came back: they are listed, none is opened unasked
    await expect(page.getByRole('button', { name: 'Kanto öffnen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Johto öffnen' })).toBeVisible()
    await page.getByRole('tab', { name: 'Bilder' }).click()
    await expect(page.getByTestId('library-image')).toHaveCount(2)
    await page.getByRole('button', { name: 'Kanto öffnen' }).click()
    await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-over-image', 'true')
    await expect(page.getByTestId('placed-image').locator('img')).toHaveCount(1)
  })

  test('binders that are not in the file stay untouched when it is read', async ({ page }) => {
    await createBinder(page, 'Alt')
    await saved(page)
    await page.getByRole('button', { name: 'Backup' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /^Alles sichern/ }).click()
    const backupPath = await (await downloadPromise).path()

    await toList(page).click()
    await createBinder(page, 'Neu')
    await saved(page)
    await page.getByLabel('Backup-Datei auswählen').setInputFiles(backupPath)

    // the file holds one binder, which is opened; the newer one is still there
    await expect(page.getByRole('heading', { name: 'Alt' })).toBeVisible()
    await toList(page).click()
    await expect(page.getByRole('button', { name: 'Neu öffnen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Alt öffnen' })).toBeVisible()
  })

  test('a reminder shows until everything was saved, and again after two weeks', async ({ page }) => {
    const reminder = page.getByTestId('backup-reminder')
    // nothing to save yet
    await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()
    await expect(reminder).toHaveCount(0)

    await createBinder(page, 'Wichtig')
    await expect(reminder).toHaveText('Noch nie gesichert')

    // the reminder itself saves everything
    const downloadPromise = page.waitForEvent('download')
    await reminder.click()
    expect((await downloadPromise).suggestedFilename()).toMatch(/^pokebinder-gesamtsicherung-/)
    await expect(reminder).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Wichtig' })).toBeVisible()
    await expect(reminder).toHaveCount(0)

    // twenty days later
    await page.evaluate(() => {
      const then = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      localStorage.setItem('pokebinder:last-full-backup', then)
    })
    await page.reload()
    await expect(reminder).toHaveText('Zuletzt gesichert vor 20 Tagen')
  })
})

test.describe('finish of a card from the search', () => {
  test('a card lands in the finish it really exists in', async ({ page }) => {
    await createBinder(page, 'Varianten')
    await page.getByRole('button', { name: 'Set', exact: true }).click()
    await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
    await expect(page.getByTestId('card-tile')).toHaveCount(207)

    // Bisasam exists as a normal card, Glurak-ex only as holo
    await drag(page, tile(page, 'sv03.5-001'), pocket(page, 1, 1))
    await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 2))

    await expect(pocket(page, 1, 1)).toHaveAttribute('data-variant', 'normal')
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', 'sv03.5-006')
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-variant', 'holo')
    await pocket(page, 1, 2).click()
    await expect(page.getByLabel('Variante')).toHaveValue('holo')

    // one step back takes the card away again; there is no hidden second step for the finish
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(pocket(page, 1, 2)).toHaveAttribute('data-card-id', '')
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', '')
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
  })

  test('without data about its finishes a card still lands, as a normal card', async ({ page, tcgdex }) => {
    await createBinder(page, 'Offline')
    await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
    await expect(tile(page, 'sv03.5-006')).toBeVisible()
    tcgdex.goOffline()

    await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 1))

    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-variant', 'normal')
  })
})

test.describe('bringing devices in line', () => {
  /** Saves everything to a file and returns where it lies. */
  async function saveAll(page: Page): Promise<string> {
    await saved(page)
    await page.getByRole('button', { name: 'Backup' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /^Alles sichern/ }).click()
    return (await downloadPromise).path()
  }
  const readFileIn = (page: Page, path: string) => page.getByLabel('Backup-Datei auswählen').setInputFiles(path)

  test('a file that would replace a binder asks first and says which side is newer', async ({ page }) => {
    await createBinder(page, 'Abgleich')
    await page.getByRole('searchbox', { name: 'Name, Set oder Nummer' }).fill('Glurak')
    await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 5))
    await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')
    const older = await saveAll(page)

    // the same version on both sides: nothing to ask, nothing changes
    await readFileIn(page, older)
    await expect(page.getByRole('dialog', { name: 'Backup einspielen' })).toHaveCount(0)
    await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')

    // this device moves on: a second card
    await drag(page, tile(page, 'sv03.5-006'), pocket(page, 1, 1))
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
    const newer = await saveAll(page)

    // the older file is offered, but not ticked: this device has the later version
    await readFileIn(page, older)
    const dialog = page.getByRole('dialog', { name: 'Backup einspielen' })
    const entry = dialog.getByTestId('import-entry')
    await expect(entry).toHaveCount(1)
    await expect(entry).toHaveAttribute('data-kind', 'older')
    await expect(entry).toContainText('Abgleich')
    await expect(entry).toContainText('Auf diesem Gerät neuer')
    await expect(entry).toContainText(/Datei: .+ · dieses Gerät: .+/)
    await expect(dialog.getByRole('checkbox', { name: 'Abgleich' })).not.toBeChecked()
    await expect(dialog.getByRole('button', { name: '0 Binder einspielen' })).toBeVisible()

    // cancelling leaves everything as it is
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(dialog).toBeHidden()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')

    // so does confirming without a tick
    await readFileIn(page, older)
    await dialog.getByRole('button', { name: '0 Binder einspielen' }).click()
    await expect(dialog).toBeHidden()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')

    // ticked, the older version replaces the one of this device
    await readFileIn(page, older)
    await dialog.getByRole('checkbox', { name: 'Abgleich' }).check()
    await dialog.getByRole('button', { name: '1 Binder einspielen' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Abgleich' })).toBeVisible()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', '')
    await expect(pocket(page, 1, 5)).toHaveAttribute('data-card-id', 'sv03.5-006')

    // now the file with the second card is the newer one: ticked from the start
    await readFileIn(page, newer)
    await expect(entry).toHaveAttribute('data-kind', 'newer')
    await expect(entry).toContainText('In der Datei neuer')
    await expect(dialog.getByRole('checkbox', { name: 'Abgleich' })).toBeChecked()
    await dialog.getByRole('button', { name: '1 Binder einspielen' }).click()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
    await page.reload()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-card-id', 'sv03.5-006')
  })

  test('binders new to this device come in beside the ones that are asked about', async ({ page }) => {
    await createBinder(page, 'Beide')
    await toList(page).click()
    await createBinder(page, 'Nur in der Datei')
    const file = await saveAll(page)

    // "Beide" changes here, the other binder is deleted here
    await toList(page).click()
    await page.getByRole('button', { name: 'Beide umbenennen' }).click()
    await page.getByRole('dialog', { name: 'Binder umbenennen' }).getByLabel('Name').fill('Beide, geändert')
    await page.getByRole('dialog', { name: 'Binder umbenennen' }).getByRole('button', { name: 'Umbenennen' }).click()
    await page.getByRole('button', { name: 'Nur in der Datei löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Nur in der Datei öffnen' })).toHaveCount(0)

    await readFileIn(page, file)
    const dialog = page.getByRole('dialog', { name: 'Backup einspielen' })
    await expect(dialog.getByTestId('import-entry')).toHaveCount(2)
    await expect(dialog.locator('[data-kind="older"]')).toContainText('Beide')
    await expect(dialog.locator('[data-kind="new"]')).toContainText('Neu, noch nicht auf diesem Gerät')
    await expect(dialog.getByRole('checkbox', { name: 'Nur in der Datei' })).toBeChecked()
    await dialog.getByRole('button', { name: '1 Binder einspielen' }).click()

    // the new one is there, the changed one kept its change
    await expect(page.getByRole('button', { name: 'Nur in der Datei öffnen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Beide, geändert öffnen' })).toBeVisible()
  })

  test('the "Merklisten" travel in the file and are merged with those of the device', async ({ page }) => {
    await createBinder(page, 'Listen')
    await page.getByRole('button', { name: 'Set', exact: true }).click()
    await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
    const results = page.getByTestId('search-results')
    const star = async (cardId: string) => {
      const found = results.locator(`[data-card-id="${cardId}"]`)
      await found.scrollIntoViewIfNeeded()
      await found.hover()
      await found.getByRole('button', { name: /merken$/ }).click()
    }
    await star('sv03.5-001')
    // a list of its own with the second card
    const second = results.locator('[data-card-id="sv03.5-002"]')
    await second.hover()
    await second.getByRole('button', { name: /^Infos zu/ }).click()
    await page.getByRole('dialog').getByLabel('Name einer neuen Liste').fill('Kaufen')
    await page.getByRole('dialog').getByRole('button', { name: 'Anlegen' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click()
    const file = await saveAll(page)
    const stored = JSON.parse(await readFile(file, 'utf8')) as { watchlists: { name: string; cards: unknown[] }[] }
    expect(stored.watchlists.map((list) => [list.name, list.cards.length])).toEqual([
      ['', 1],
      ['Kaufen', 1],
    ])

    // another device: no lists yet except one card noted there
    await page.evaluate(() => localStorage.removeItem('pokebinder:watchlists'))
    await page.reload()
    await expect(page.getByTestId('spread-label')).toBeVisible()
    await expect(page.getByTestId('saved-count')).toHaveCount(0)
    await page.getByRole('button', { name: 'Set', exact: true }).click()
    await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
    await star('sv03.5-003')

    await readFileIn(page, file)
    // the binder is the same on both sides, so nothing is asked; the lists come in all the same
    await expect(page.getByRole('dialog', { name: 'Backup einspielen' })).toHaveCount(0)
    await page.getByRole('tab', { name: /^Merkliste/ }).click()
    const chooser = page.getByTestId('column-left').getByRole('combobox', { name: 'Merkliste' })
    // what was noted here stays, what the file brings is added
    await expect(chooser.locator('option')).toHaveText(['Schnellmerken (2)', 'Kaufen (1)'])
    await expect(page.getByTestId('saved-count')).toHaveText('3')

    // reading the same file again adds nothing twice
    await readFileIn(page, file)
    await page.getByRole('tab', { name: /^Merkliste/ }).click()
    await expect(chooser.locator('option')).toHaveText(['Schnellmerken (2)', 'Kaufen (1)'])
  })
})
