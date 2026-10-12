import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from './fixtures'

/** Opens the assistant on "Master Set" with the given set chosen and its cards loaded. */
async function startMasterSet(page: Page, setName: RegExp): Promise<Locator> {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByText('Master Set', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Set', exact: true }).click()
  await dialog.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: setName }).click()
  await expect(dialog.getByTestId('master-set-summary')).toBeVisible()
  return dialog
}

async function create(page: Page, dialog: Locator, heading: string) {
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
}

function pocket(page: Page, pageNumber: number, position: number): Locator {
  return page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .nth(position - 1)
}

const cardsOn = (page: Page, pageNumber: number) =>
  page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .evaluateAll((pockets) =>
      pockets.map((item) => `${item.getAttribute('data-card-id')}/${item.getAttribute('data-variant')}`),
    )

const saved = (page: Page) => expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('a master set without holo variants holds every card TCGdex lists for the set', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await expect(dialog.getByRole('switch', { name: /Mit Holo-Varianten/ })).not.toBeChecked()
  // TCGdex lists 207 cards for "151": 165 official ones and 42 secret rares
  await expect(dialog.getByTestId('master-set-summary')).toHaveText(
    'Ergibt 207 Karten auf 23 Seiten. Alle Karten starten als „fehlt“.',
  )

  // without a name the binder is called like its set
  await create(page, dialog, '151')

  await expect(page.getByTestId('progress')).toContainText('0 / 207 Karten gesammelt')
  await expect(page.getByTestId('progress')).toContainText('207 fehlen')
  expect(await cardsOn(page, 1)).toEqual(
    Array.from({ length: 9 }, (_, i) => `sv03.5-00${i + 1}/${[3, 6, 9].includes(i + 1) ? 'holo' : 'normal'}`),
  )
  // every card starts as missing, shown in black and white
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'false')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Bisasam' })).toHaveCSS('filter', 'grayscale(1)')

  // 23 pages: page 1 alone, then eleven double pages
  const thumbnails = page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button')
  await expect(thumbnails).toHaveCount(12)
  await thumbnails.last().click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seiten 22 – 23')
  expect(await cardsOn(page, 23)).toEqual(
    Array.from({ length: 9 }, (_, i) => `sv03.5-${199 + i}/holo`),
  )

  await saved(page)
  await page.reload()
  await expect(page.getByTestId('progress')).toContainText('0 / 207 Karten gesammelt')
})

test('with holo variants every reverse holo gets its own pocket behind its card', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await dialog.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  // 207 cards plus 153 reverse holos
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 360 Karten auf 40 Seiten.')
  await dialog.getByLabel('Name').fill('151 komplett')
  await create(page, dialog, '151 komplett')

  await expect(page.getByTestId('progress')).toContainText('0 / 360 Karten gesammelt')
  expect(await cardsOn(page, 1)).toEqual([
    'sv03.5-001/normal',
    'sv03.5-001/reverse',
    'sv03.5-002/normal',
    'sv03.5-002/reverse',
    'sv03.5-003/holo', // Bisaflor-ex exists as holo only
    'sv03.5-004/normal',
    'sv03.5-004/reverse',
    'sv03.5-005/normal',
    'sv03.5-005/reverse',
  ])
  await expect(pocket(page, 1, 2).getByTestId('variant-badge')).toHaveText('Reverse Holo')
  await expect(pocket(page, 1, 1).getByTestId('variant-badge')).toHaveCount(0)
})

test('special reverse patterns of a set get pockets of their own', async ({ page }) => {
  const dialog = await startMasterSet(page, /^Prismatische Entwicklungen/)
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 180 Karten auf 20 Seiten.')
  await dialog.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 447 Karten auf 50 Seiten.')
  await create(page, dialog, 'Prismatische Entwicklungen')

  expect((await cardsOn(page, 1)).slice(0, 5)).toEqual([
    'sv08.5-001/normal',
    'sv08.5-001/reverse',
    'sv08.5-001/masterball',
    'sv08.5-001/pokeball',
    'sv08.5-002/normal',
  ])
  await expect(pocket(page, 1, 3).getByTestId('variant-badge')).toHaveText('Meisterball')
  await expect(pocket(page, 1, 4).getByTestId('variant-badge')).toHaveText('Pokéball')
})

test('secret rares can be left out by rarity', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  const secretRares = dialog.getByRole('group', { name: 'Secret Rares' })
  await expect(secretRares.getByRole('checkbox')).toHaveCount(4)
  await expect(secretRares).toContainText('Selten, Illustration (16)')
  await expect(secretRares).toContainText('Ultra Selten (16)')
  await expect(secretRares).toContainText('Selten, besondere Illustration (7)')
  await expect(secretRares).toContainText('Hyperselten (3)')
  for (const box of await secretRares.getByRole('checkbox').all()) await expect(box).toBeChecked()

  await secretRares.getByLabel('Selten, Illustration (16)').uncheck()
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 191 Karten auf 22 Seiten.')

  for (const box of await secretRares.getByRole('checkbox').all()) await box.uncheck()
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 165 Karten auf 19 Seiten.')

  await secretRares.getByLabel('Hyperselten (3)').check()
  await create(page, dialog, '151')
  await expect(page.getByTestId('progress')).toContainText('0 / 168 Karten gesammelt')
  await page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button').last().click()
  // after card 165 the three hyper rares 205 to 207 follow directly
  expect((await cardsOn(page, 19)).slice(2, 6)).toEqual([
    'sv03.5-165/normal',
    'sv03.5-205/holo',
    'sv03.5-206/holo',
    'sv03.5-207/holo',
  ])
})

test('promos of the series are appended at the end', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  const promos = dialog.getByRole('switch', { name: /Promos/ })
  await expect(promos).not.toBeChecked()
  await expect(dialog.getByText(/Karten aus „SVP Black Star Promos“ kommen ans Ende/)).toBeVisible()

  await promos.check()
  // TCGdex has 198 of the series' promos in German
  await expect(dialog.getByText('198 Karten aus „SVP Black Star Promos“ kommen ans Ende des Binders.')).toBeVisible()
  await expect(dialog.getByTestId('master-set-summary')).toContainText('Ergibt 405 Karten auf 45 Seiten.')
  await create(page, dialog, '151')

  await expect(page.getByTestId('progress')).toContainText('0 / 405 Karten gesammelt')
  // page 23 holds the last cards of the set (199 to 207), page 24 starts with the promos
  await page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button', { name: 'Seiten 24 – 25' }).click()
  expect((await cardsOn(page, 24)).slice(0, 2)).toEqual(['svp-001/holo', 'svp-002/holo'])
  await pocket(page, 24, 1).click()
  await expect(page.getByTestId('selected-rarity')).toHaveText('Promo')
})

test('an existing master set can be changed afterwards: promos, holo variants, secret rares', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await dialog.getByRole('group', { name: 'Secret Rares' }).getByLabel('Hyperselten (3)').uncheck()
  await create(page, dialog, '151')
  await expect(page.getByTestId('progress')).toContainText('0 / 204 Karten gesammelt')

  // own Bisasam and Glurak-ex before changing anything
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await pocket(page, 1, 1).click()
  await pocket(page, 1, 6).click()
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(page.getByTestId('progress')).toContainText('2 / 204 Karten gesammelt')

  // the dialog opens with what the binder was built with
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Master Set anpassen' }).click()
  const settings = page.getByRole('dialog', { name: 'Master Set anpassen' })
  await expect(settings.getByTestId('master-set-summary')).toHaveText(
    'Das Master Set hat danach 204 Karten auf 23 Seiten.',
  )
  await expect(settings.getByRole('switch', { name: /Mit Holo-Varianten/ })).not.toBeChecked()
  await expect(settings.getByRole('switch', { name: /Promos/ })).not.toBeChecked()
  await expect(settings.getByLabel('Hyperselten (3)')).not.toBeChecked()
  await expect(settings.getByLabel('Ultra Selten (16)')).toBeChecked()
  // the set itself is fixed
  await expect(settings.getByRole('button', { name: 'Set', exact: true })).toHaveCount(0)

  // add the promos and the holo variants, bring the hyper rares back
  await settings.getByRole('switch', { name: /Promos/ }).check()
  await settings.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  await settings.getByLabel('Hyperselten (3)').check()
  await expect(settings.getByTestId('master-set-summary')).toHaveText(
    'Das Master Set hat danach 558 Karten auf 62 Seiten.',
  )
  await settings.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(settings).toBeHidden()

  // sorted again, with the reverse holos in between; what was owned is still owned
  await expect(page.getByTestId('progress')).toContainText('2 / 558 Karten gesammelt')
  expect((await cardsOn(page, 1)).slice(0, 3)).toEqual(['sv03.5-001/normal', 'sv03.5-001/reverse', 'sv03.5-002/normal'])
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')
  await expect(pocket(page, 1, 2)).toHaveAttribute('data-owned', 'false')
  await page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button').last().click()
  await expect(page.getByTestId('spread-label')).toHaveText('Seite 62')
  await saved(page)

  // and back: the promos and reverse holos are deleted, the rest moves up
  await page.reload()
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Master Set anpassen' }).click()
  await expect(settings.getByRole('switch', { name: /Promos/ })).toBeChecked()
  await expect(settings.getByRole('switch', { name: /Mit Holo-Varianten/ })).toBeChecked()
  await settings.getByRole('switch', { name: /Promos/ }).uncheck()
  await settings.getByRole('switch', { name: /Mit Holo-Varianten/ }).uncheck()
  await expect(settings.getByTestId('master-set-summary')).toHaveText(
    'Das Master Set hat danach 207 Karten auf 23 Seiten.',
  )
  await settings.getByRole('button', { name: 'Übernehmen' }).click()

  await expect(page.getByTestId('progress')).toContainText('2 / 207 Karten gesammelt')
  await expect(page.getByRole('navigation', { name: 'Doppelseiten' }).getByRole('button')).toHaveCount(12)
  expect(await cardsOn(page, 1)).toEqual(
    Array.from({ length: 9 }, (_, i) => `sv03.5-00${i + 1}/${[3, 6, 9].includes(i + 1) ? 'holo' : 'normal'}`),
  )
  await expect(pocket(page, 1, 6)).toHaveAttribute('data-owned', 'true')
})

test('cancelling the change leaves the master set as it is, and empty binders have no such button', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await create(page, dialog, '151')

  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Master Set anpassen' }).click()
  const settings = page.getByRole('dialog', { name: 'Master Set anpassen' })
  await settings.getByRole('switch', { name: /Promos/ }).check()
  await settings.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByTestId('progress')).toContainText('0 / 207 Karten gesammelt')

  await page.getByRole('banner').getByRole('button', { name: 'Meine Binder' }).click()
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Leer')
  await page.getByRole('dialog').getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: 'Leer', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mehr', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Binder umbenennen' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Master Set anpassen' })).toHaveCount(0)
})

test('the assistant waits for a set and can be switched back to an empty binder', async ({ page }) => {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByText('Master Set', { exact: true }).click()
  await expect(dialog.getByText('Bitte ein Set wählen.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Anlegen' })).toBeDisabled()

  await dialog.getByText('Leerer Binder', { exact: true }).click()
  await expect(dialog.getByText('Bitte ein Set wählen.')).toBeHidden()
  await dialog.getByLabel('Name').fill('Doch leer')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()

  await expect(page.getByRole('heading', { name: 'Doch leer' })).toBeVisible()
  await expect(page.getByTestId('pocket').and(page.locator('[data-card-id=""]'))).toHaveCount(9)
  // without cards there is nothing to count
  await expect(page.getByTestId('progress')).toHaveCount(0)
})

test('in collection mode a click marks a card as owned or missing and the progress follows', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await create(page, dialog, '151')
  const progress = page.getByTestId('progress')
  const bar = page.getByRole('progressbar', { name: 'Fortschritt der Sammlung' })
  await expect(bar).toHaveAttribute('aria-valuenow', '0')
  await expect(bar).toHaveAttribute('aria-valuemax', '207')

  // in edit mode a click only selects
  await pocket(page, 1, 1).click()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'false')

  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  await pocket(page, 1, 1).click()
  await pocket(page, 1, 5).click()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')
  await expect(pocket(page, 1, 1).getByRole('img', { name: 'Bisasam' })).toHaveCSS('filter', 'none')
  await expect(progress).toContainText('2 / 207 Karten gesammelt')
  await expect(progress).toContainText('205 fehlen')
  await expect(bar).toHaveAttribute('aria-valuenow', '2')

  await pocket(page, 1, 5).click()
  await expect(pocket(page, 1, 5)).toHaveAttribute('data-owned', 'false')
  await expect(progress).toContainText('1 / 207 Karten gesammelt')

  // cards stay where they are: dragging and right click are for edit mode
  const start = await pocket(page, 1, 1).boundingBox()
  const end = await pocket(page, 1, 2).boundingBox()
  if (!start || !end) throw new Error('Pockets not visible')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 })
  await page.mouse.up()
  await pocket(page, 1, 3).click({ button: 'right' })
  expect((await cardsOn(page, 1)).slice(0, 3)).toEqual(['sv03.5-001/normal', 'sv03.5-002/normal', 'sv03.5-003/holo'])
  await expect(page.getByText('Karten in einen Pocket ziehen')).toBeHidden()

  await saved(page)
  await page.reload()
  await expect(page.getByTestId('progress')).toContainText('1 / 207 Karten gesammelt')
  // a reload returns to edit mode
  await expect(page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Bearbeiten' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('the selection column shows variant and rarity, and the variant can be changed', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await create(page, dialog, '151')

  await pocket(page, 1, 1).click()
  await expect(page.getByTestId('selected-rarity')).toHaveText('Häufig')
  const variant = page.getByLabel('Variante')
  await expect(variant).toHaveValue('normal')
  // Bisasam exists as normal card and as reverse holo
  await expect(variant.locator('option')).toHaveText(['Normal', 'Reverse Holo'])

  await variant.selectOption('reverse')
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-variant', 'reverse')
  await expect(pocket(page, 1, 1).getByTestId('variant-badge')).toHaveText('Reverse Holo')

  await pocket(page, 1, 3).click()
  await expect(page.getByTestId('selected-rarity')).toHaveText('Doppelselten')
  await expect(page.getByLabel('Variante').locator('option')).toHaveText(['Holo'])

  await saved(page)
  await page.reload()
  await expect(pocket(page, 1, 1)).toHaveAttribute('data-variant', 'reverse')
})

test('the PDF checklist has a tickable box for exactly the missing cards', async ({ page }) => {
  const dialog = await startMasterSet(page, /^151/)
  await dialog.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  await dialog.getByLabel('Name').fill('Kanto Collection')
  await create(page, dialog, 'Kanto Collection')

  // own Bisasam (normal), Bisaknosp (reverse) and Bisaflor-ex
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  for (const position of [1, 4, 5]) await pocket(page, 1, position).click()
  await expect(page.getByTestId('progress')).toContainText('3 / 360 Karten gesammelt')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Was fehlt?', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Als PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^fehlende-karten-kanto-collection-\d{4}-\d{2}-\d{2}\.pdf$/)

  const pdf = await PDFDocument.load(await readFile(await download.path()))
  expect(pdf.getTitle()).toBe('Fehlende Karten – Kanto Collection')
  const boxes = pdf.getForm().getFields().map((field) => field.getName())
  expect(boxes).toHaveLength(357)
  expect(boxes.slice(0, 7)).toEqual([
    'fehlt_1_sv03.5-001_reverse',
    'fehlt_2_sv03.5-002_normal',
    'fehlt_3_sv03.5-004_normal',
    'fehlt_4_sv03.5-004_reverse',
    'fehlt_5_sv03.5-005_normal',
    'fehlt_6_sv03.5-005_reverse',
    'fehlt_7_sv03.5-006_holo',
  ])
  // the cards that are owned are not on the list
  const listed = boxes.map((name) => name.replace(/^fehlt_\d+_/, ''))
  for (const owned of ['sv03.5-001_normal', 'sv03.5-002_reverse', 'sv03.5-003_holo']) {
    expect(listed).not.toContain(owned)
  }
  expect(listed.at(-1)).toBe('sv03.5-207_holo')
  expect(pdf.getForm().getCheckBox(boxes[0] ?? '').isChecked()).toBe(false)
  expect(pdf.getPageCount()).toBeGreaterThan(5)
})

test('a complete binder gets a checklist that says nothing is missing', async ({ page }) => {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Fertig')
  await page.getByRole('dialog').getByRole('button', { name: 'Anlegen' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Was fehlt?', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Als PDF' }).click()
  const pdf = await PDFDocument.load(await readFile(await (await downloadPromise).path()))

  expect(pdf.getPageCount()).toBe(1)
  expect(pdf.getForm().getFields()).toEqual([])
})
