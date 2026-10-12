import { readFile } from 'node:fs/promises'
import type { Download, Locator, Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from './fixtures'

/** Creates the master set of "151"; with `variants` every reverse holo gets its own pocket. */
async function createMasterSet(page: Page, variants = false) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByText('Master Set', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Set', exact: true }).click()
  await dialog.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(dialog.getByTestId('master-set-summary')).toBeVisible()
  if (variants) await dialog.getByRole('switch', { name: /Mit Holo-Varianten/ }).check()
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: '151', exact: true })).toBeVisible()
}

function pocket(page: Page, pageNumber: number, position: number): Locator {
  return page
    .getByRole('region', { name: `Seite ${pageNumber}`, exact: true })
    .getByTestId('pocket')
    .nth(position - 1)
}

async function exportFromMenu(page: Page, entry: string): Promise<Download> {
  await page.getByRole('button', { name: 'Was fehlt?', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: entry }).click()
  return downloadPromise
}

const collection = (page: Page) =>
  page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' })

/** "1.234,50 €" → 1234.5 */
const euros = (text: string) => Number(text.replace(' €', '').replaceAll('.', '').replace(',', '.'))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test.describe('Cardmarket prices', () => {
  test('the selection column shows the price of the chosen card and finish', async ({ page }) => {
    await createMasterSet(page)
    const price = page.getByTestId('selected-price')

    await pocket(page, 1, 1).click()
    await expect(price).toHaveText(/^\d+,\d{2} €$/)
    const normal = euros((await price.textContent()) ?? '')
    expect(normal).toBeGreaterThan(0)

    // the reverse holo of the same card has a price of its own
    await page.getByLabel('Variante').selectOption('reverse')
    await expect(price).toHaveText(/^\d+,\d{2} €$/)
    await expect.poll(async () => euros((await price.textContent()) ?? '')).not.toBe(normal)

    // a card Cardmarket has nothing on (here: not among the recorded answers)
    await pocket(page, 1, 9).click()
    await expect(price).toHaveText('kein Preis')
  })

  test('"Wert berechnen" adds up owned and missing cards', async ({ page }) => {
    await createMasterSet(page)
    const prices: number[] = []
    for (const position of [1, 2, 3]) {
      await pocket(page, 1, position).click()
      await expect(page.getByTestId('selected-price')).toHaveText(/^\d+,\d{2} €$/)
      prices.push(euros((await page.getByTestId('selected-price').textContent()) ?? ''))
    }
    const [bisasam = 0, bisaknosp = 0, bisaflor = 0] = prices
    // own the first card only
    await collection(page).click()
    await pocket(page, 1, 1).click()

    await expect(page.getByTestId('binder-value')).toHaveCount(0)
    await page.getByRole('button', { name: 'Wert berechnen' }).click()

    const value = page.getByTestId('binder-value')
    await expect(value).toContainText('fehlen noch')
    const text = (await value.textContent()) ?? ''
    const [owned, missing] = [...text.matchAll(/([\d.]+,\d{2}) €/g)].map((match) => euros(match[1] ?? ''))
    expect(owned).toBeCloseTo(bisasam, 2)
    expect(missing).toBeCloseTo(bisaknosp + bisaflor, 2)
    // 207 cards, three of them with a recorded price
    await expect(value).toContainText('204 Karten ohne Preis')

    // after a change the value is no longer shown as if it were current
    await pocket(page, 1, 2).click()
    await expect(page.getByTestId('binder-value')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Wert berechnen' })).toBeVisible()
  })
})

test.describe('list of missing cards', () => {
  test('as CSV it opens in Excel: one line per card, with price and sum', async ({ page }) => {
    await createMasterSet(page)
    await collection(page).click()
    await pocket(page, 1, 2).click() // own Bisaknosp

    const download = await exportFromMenu(page, 'Als CSV (Excel)')
    expect(download.suggestedFilename()).toMatch(/^fehlende-karten-151-\d{4}-\d{2}-\d{2}\.csv$/)
    const file = await readFile(await download.path())
    // UTF-8 with byte order mark
    expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = file.subarray(3).toString('utf8').trimEnd().split('\r\n')

    expect(lines[0]).toBe('Set;Nummer;Name;Variante;Seltenheit;Sprache;Binder-Seite;Preis (EUR)')
    // 206 missing cards, plus header and sum
    expect(lines).toHaveLength(208)
    expect(lines[1]).toMatch(/^151;"=""001\/165""";Bisasam;Normal;Häufig;Deutsch;1;\d+,\d{2}$/)
    expect(lines[2]).toMatch(/^151;"=""003\/165""";Bisaflor-ex;Holo;Doppelselten;Deutsch;1;\d+,\d{2}$/)
    // the owned card 002 is not on the list (its illustration rare 167 still is)
    expect(lines.some((line) => line.includes('"=""002/165"""'))).toBe(false)
    // the last card of the set lies on page 23; its price is not among the recorded ones
    expect(lines.at(-2)).toMatch(/^151;"=""207\/165""";[^;]+;Holo;Hyperselten;Deutsch;23;$/)
    expect(lines.at(-1)).toMatch(/^Summe;;;;;;;\d+,\d{2}$/)

    const priceOf = (line: string | undefined) => Number((line ?? '').split(';').at(-1)?.replace(',', '.'))
    expect(priceOf(lines.at(-1))).toBeCloseTo(priceOf(lines[1]) + priceOf(lines[2]), 2)
  })

  test('the PDF checklist still has one box per missing card, now with prices', async ({ page }) => {
    await createMasterSet(page)

    const download = await exportFromMenu(page, 'Als PDF')
    const pdf = await PDFDocument.load(await readFile(await download.path()))

    expect(pdf.getForm().getFields()).toHaveLength(207)
  })

  test('placeholders are printed nine to an A4 sheet', async ({ page }) => {
    await createMasterSet(page)
    await collection(page).click()
    for (const position of [1, 2, 3]) await pocket(page, 1, position).click()
    await expect(page.getByTestId('progress')).toContainText('3 / 207 Karten gesammelt')

    const download = await exportFromMenu(page, 'Platzhalter drucken (PDF)')
    expect(download.suggestedFilename()).toMatch(/^platzhalter-151-\d{4}-\d{2}-\d{2}\.pdf$/)
    const pdf = await PDFDocument.load(await readFile(await download.path()))

    // 204 missing cards on 23 sheets
    expect(pdf.getTitle()).toBe('Platzhalter – 151')
    expect(pdf.getPageCount()).toBe(23)
    const toMm = (points: number) => Math.round((points * 25.4) / 72)
    expect(pdf.getPages().every((sheet) => toMm(sheet.getWidth()) === 210 && toMm(sheet.getHeight()) === 297)).toBe(true)
    // the pictures are in the file, not just frames
    expect((await readFile(await download.path())).length).toBeGreaterThan(40_000)
  })
})

test.describe('holo effect', () => {
  test('foil cards one owns shimmer under the mouse, others do not', async ({ page }) => {
    await createMasterSet(page, true)
    // pocket 1: Bisasam normal, pocket 2: its reverse holo, pocket 5: Bisaflor-ex (holo)
    await collection(page).click()
    for (const position of [1, 2]) await pocket(page, 1, position).click()
    await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Bearbeiten' }).click()

    const reverse = pocket(page, 1, 2)
    await expect(reverse.locator('[data-holo="true"]')).toHaveCount(1)
    // a normal card has no foil, and a missing card nothing to shine with
    await expect(pocket(page, 1, 1).locator('[data-holo="true"]')).toHaveCount(0)
    await expect(pocket(page, 1, 5).locator('[data-holo="true"]')).toHaveCount(0)

    const shine = reverse.locator('.holo-shine')
    await page.mouse.move(0, 0)
    await expect(shine).toHaveCSS('opacity', '0')

    const box = await reverse.boundingBox()
    if (!box) throw new Error('Pocket not visible')
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3)
    await expect(shine).toHaveCSS('opacity', '1')
    // the glare follows the pointer and the card tips towards it
    const card = reverse.locator('[data-holo="true"]')
    await expect.poll(() => card.evaluate((element) => element.style.getPropertyValue('--holo-x'))).toMatch(/^8\d/)
    await expect(card).not.toHaveCSS('transform', 'none')

    await page.mouse.move(0, 0)
    await expect(shine).toHaveCSS('opacity', '0')
  })

  test('the effect keeps still for people who asked for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await createMasterSet(page, true)
    await collection(page).click()
    await pocket(page, 1, 2).click()

    await pocket(page, 1, 2).hover()

    await expect(pocket(page, 1, 2).locator('[data-holo="true"]')).toHaveCSS('transform', 'none')
  })
})

test.describe('shopping list', () => {
  const amount = async (locator: Locator) => euros((await locator.textContent()) ?? '')

  test('the missing cards of a binder with prices, cheapest first, a budget and links to Cardmarket', async ({ page }) => {
    await createMasterSet(page)
    await page.getByRole('button', { name: 'Kaufliste', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Kaufliste – 151' })
    const rows = dialog.getByTestId('shopping-row')
    const priced = dialog.locator('[data-testid="shopping-row"]:has([data-testid="shopping-price"].font-medium)')

    // every card of a fresh master set is still missing: 165 and the secret rares
    await expect(dialog.getByTestId('shopping-total')).toContainText(/^207 Karten · Summe: [0-9.]+,[0-9]{2} €/)
    await expect(rows).toHaveCount(207)
    const pricedCount = await priced.count()
    expect(pricedCount).toBeGreaterThanOrEqual(2)

    // cheapest first; cards without a price at the end
    const first = await amount(priced.nth(0).getByTestId('shopping-price'))
    const second = await amount(priced.nth(1).getByTestId('shopping-price'))
    expect(first).toBeLessThanOrEqual(second)
    await expect(rows.first().getByTestId('shopping-price')).toHaveText(/€$/)
    await expect(rows.last().getByTestId('shopping-price')).toHaveText('kein Preis')

    // each line names the card and leads to it at Cardmarket, in a tab of its own
    const link = priced.nth(0).getByRole('link', { name: /bei Cardmarket öffnen$/ })
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.cardmarket\.com\/de\/Pokemon\/Products\?idProduct=[0-9]+$/)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(rows.last().getByRole('link')).toHaveAttribute(
      'href',
      /^https:\/\/www\.cardmarket\.com\/de\/Pokemon\/Products\/Search\?searchString=.+/,
    )

    // a budget that covers the cheapest card only
    await dialog.getByLabel('Budget in €').fill(String(first).replace('.', ','))
    await expect(dialog.getByTestId('shopping-budget')).toContainText(/^Reicht für [0-9]+ von 207 Karten \([0-9.]+,[0-9]{2} €\)/)
    await expect(rows.first()).toHaveAttribute('data-affordable', 'true')
    await expect(rows.last()).toHaveAttribute('data-affordable', 'false')
    // nothing for no money, and no budget line for something that is no amount
    await dialog.getByLabel('Budget in €').fill('0')
    await expect(dialog.getByTestId('shopping-budget')).toContainText('Reicht für 0 von 207 Karten')
    await dialog.getByLabel('Budget in €').fill('viel')
    await expect(dialog.getByTestId('shopping-budget')).toHaveCount(0)
    await expect(rows.first()).toHaveAttribute('data-affordable', 'true')

    // the other orders
    await dialog.getByLabel('Reihenfolge').selectOption({ label: 'Teuerste zuerst' })
    expect(await amount(rows.first().getByTestId('shopping-price'))).toBeGreaterThanOrEqual(second)
    await dialog.getByLabel('Reihenfolge').selectOption({ label: 'Wie im Binder' })
    await expect(rows.first()).toHaveAttribute('data-card-id', 'sv03.5-001')

    await dialog.getByRole('button', { name: 'Schließen' }).click()
    await expect(dialog).toBeHidden()
  })

  test('a card that is there is not on the list', async ({ page }) => {
    await createMasterSet(page)
    await collection(page).click()
    await pocket(page, 1, 1).click()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')

    await page.getByRole('button', { name: 'Kaufliste', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Kaufliste – 151' })
    await expect(dialog.getByTestId('shopping-row')).toHaveCount(206)
    await expect(dialog.locator('[data-card-id="sv03.5-001"]')).toHaveCount(0)
  })

  test('a "Merkliste" has its shopping list too', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
    await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
    await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
    const results = page.getByTestId('browse-results')
    for (const id of ['sv03.5-001', 'sv03.5-002']) {
      const found = results.locator(`[data-card-id="${id}"]`)
      await found.hover()
      await found.getByRole('button', { name: /merken$/ }).click()
    }
    await page.getByTestId('page').getByRole('tab', { name: /^Merkliste/ }).click()
    await page.getByTestId('browse-watchlist').getByRole('button', { name: 'Kaufliste' }).click()

    const dialog = page.getByRole('dialog', { name: 'Kaufliste – Schnellmerken' })
    await expect(dialog.getByTestId('shopping-row')).toHaveCount(2)
    await expect(dialog.getByTestId('shopping-total')).toContainText(/^2 Karten · Summe: [0-9.]+,[0-9]{2} €/)
    await expect(dialog.locator('[data-card-id="sv03.5-001"]')).toContainText('Bisasam')
    await expect(dialog.locator('[data-card-id="sv03.5-001"]')).toContainText('151 · 001/165')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('cards there are several of', () => {
  test('a card is counted, shows its number, and what is spare stands on the trade list', async ({ page }) => {
    await createMasterSet(page)
    const copies = page.getByTestId('copies')
    const more = page.getByRole('button', { name: 'Anzahl erhöhen' })
    const fewer = page.getByRole('button', { name: 'Anzahl verringern' })

    // a card that is missing cannot be counted
    await pocket(page, 1, 1).click()
    await expect(copies).toHaveText('0')
    await expect(more).toBeDisabled()
    await expect(fewer).toBeDisabled()

    // there once, then three times
    await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Vorhanden' }).click()
    await expect(copies).toHaveText('1')
    await expect(fewer).toBeDisabled()
    await expect(pocket(page, 1, 1).getByTestId('copies-badge')).toHaveCount(0)
    await more.click()
    await more.click()
    await expect(copies).toHaveText('3')
    await expect(pocket(page, 1, 1).getByTestId('copies-badge')).toHaveText('×3')

    // a second card twice
    await pocket(page, 1, 2).click()
    await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Vorhanden' }).click()
    await more.click()
    await expect(pocket(page, 1, 2).getByTestId('copies-badge')).toHaveText('×2')

    // the trade list: what is there beyond the one copy in the binder
    await page.getByRole('button', { name: 'Mehr', exact: true }).click()
    await page.getByRole('menuitem', { name: /^Tauschliste/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Tauschliste – 151' })
    const rows = dialog.getByTestId('shopping-row')
    await expect(rows).toHaveCount(2)
    await expect(dialog.getByTestId('shopping-total')).toContainText(/^3 Karten · Summe: [0-9.]+,[0-9]{2} €/)
    // two spare copies of the first card, priced per piece
    await expect(dialog.locator('[data-card-id="sv03.5-001"]').getByTestId('shopping-price')).toHaveText(/^2 × [0-9.]+,[0-9]{2} €$/)
    // nothing to buy here, so no budget
    await expect(dialog.getByLabel('Budget in €')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Schließen' }).click()

    // the number is stored, and it counts in the value of the binder
    await expect(page.getByRole('banner').getByRole('status')).toHaveText('Lokal gespeichert')
    await page.reload()
    await expect(pocket(page, 1, 1).getByTestId('copies-badge')).toHaveText('×3')
    await page.getByRole('button', { name: 'Wert berechnen' }).click()
    const value = page.getByTestId('binder-value')
    await expect(value).toContainText('vorhanden')
    const owned = euros((/Wert: ([0-9.,]+ €) vorhanden/.exec((await value.textContent()) ?? '')?.[1] ?? ''))
    await pocket(page, 1, 1).click()
    await fewer.click()
    await fewer.click()
    await expect(pocket(page, 1, 1).getByTestId('copies-badge')).toHaveCount(0)
    await page.getByRole('button', { name: 'Wert berechnen' }).click()
    await expect(value).toContainText('vorhanden')
    const ownedOnce = euros((/Wert: ([0-9.,]+ €) vorhanden/.exec((await value.textContent()) ?? '')?.[1] ?? ''))
    expect(ownedOnce).toBeLessThan(owned)

    // marked as missing, the card is no longer counted
    await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Fehlt' }).click()
    await expect(copies).toHaveText('0')
  })

  test('without spare cards the trade list says how to count them', async ({ page }) => {
    await createMasterSet(page)
    await page.getByRole('button', { name: 'Mehr', exact: true }).click()
    await page.getByRole('menuitem', { name: /^Tauschliste/ }).click()

    await expect(page.getByRole('dialog', { name: 'Tauschliste – 151' })).toContainText('Du hast keine Karte doppelt.')
  })

  test('the number is no part of an exported page', async ({ page }) => {
    await createMasterSet(page)
    await pocket(page, 1, 1).click()
    await page.getByRole('group', { name: 'Besitz' }).getByRole('button', { name: 'Vorhanden' }).click()
    await page.getByRole('button', { name: 'Anzahl erhöhen' }).click()

    // marked like the buttons that an export leaves out
    await expect(pocket(page, 1, 1).getByTestId('copies-badge')).toHaveAttribute('data-export-hide', /.*/)
  })
})

test.describe('the worth of the collection on the shelf', () => {
  test('each binder says how much of it is there and what that is worth; above stands the sum', async ({ page }) => {
    await createMasterSet(page)
    await collection(page).click()
    await pocket(page, 1, 1).click()
    await expect(pocket(page, 1, 1)).toHaveAttribute('data-owned', 'true')
    // what the binder itself says its owned cards are worth
    await page.getByRole('button', { name: 'Wert berechnen' }).click()
    const inBinder = (await page.getByTestId('binder-value').textContent()) ?? ''
    const owned = /Wert: ([0-9.,]+ €) vorhanden/.exec(inBinder)?.[1]
    expect(owned).toBeDefined()

    await page.getByRole('button', { name: 'Meine Karten' }).click()

    const tile = page.getByTestId('binder-tile').getByTestId('binder-worth')
    await expect(tile).toHaveText(`1 / 207 vorhanden · ${owned}`)
    await expect(page.getByTestId('shelf-total')).toHaveText(`Sammlungswert: ${owned} · 1 von 207 Karten vorhanden`)
    expect(euros(owned ?? '')).toBeGreaterThan(0)

    // an empty binder beside it changes nothing about the sum and shows no worth
    await page.getByRole('button', { name: 'Neuer Binder' }).click()
    const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
    await dialog.getByLabel('Name').fill('Leer')
    await dialog.getByRole('button', { name: 'Anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Leer' })).toBeVisible()
    await page.getByRole('button', { name: 'Meine Karten' }).click()
    await expect(page.getByTestId('binder-tile')).toHaveCount(2)
    await expect(page.getByTestId('binder-worth')).toHaveCount(1)
    await expect(page.getByTestId('shelf-total')).toHaveText(`Sammlungswert: ${owned} · 1 von 207 Karten vorhanden`)
  })
})
