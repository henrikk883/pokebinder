import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

function pocket(page: Page, position: number): Locator {
  return page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').nth(position - 1)
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

/** A binder "Kanto" with Bisasam, Glumanda and Schiggy in the first three pockets. */
async function binderWithThreeCards(page: Page) {
  await page.goto('/')
  await createBinder(page, 'Kanto')
  const column = page.getByTestId('column-left')
  await column.getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  const tile = (id: string) => column.locator(`[data-testid="card-tile"][data-card-id="${id}"] img`)
  await drag(page, tile('sv03.5-001'), pocket(page, 1))
  await drag(page, tile('sv03.5-004'), pocket(page, 2))
  await drag(page, tile('sv03.5-007'), pocket(page, 3))
  await expect(pocket(page, 3)).toHaveAttribute('data-card-id', 'sv03.5-007')
}

const modes = (page: Page) => page.getByRole('group', { name: 'Modus' })
const trayCards = (page: Page) => page.getByTestId('tray').getByTestId('tray-card')
const ids = (cards: Locator) => cards.evaluateAll((list) => list.map((card) => card.getAttribute('data-card-id')))

test('cards are laid aside while a binder is rearranged, stay there, and go back into pockets', async ({ page }) => {
  await binderWithThreeCards(page)
  const column = page.getByTestId('column-left')
  await expect(modes(page).getByRole('button')).toHaveText(['Bearbeiten', 'Sammlung', 'Ablage'])

  // the tray takes the place of the search
  await modes(page).getByRole('button', { name: 'Ablage' }).click()
  await expect(column.getByRole('heading', { name: 'Ablage' })).toBeVisible()
  await expect(column.getByRole('searchbox')).toBeHidden()
  await expect(page.getByTestId('tray')).toContainText('Die Ablage ist leer.')

  // a card dragged there leaves its pocket; the button counts
  await drag(page, pocket(page, 1).locator('img'), page.getByTestId('tray'))
  await expect(pocket(page, 1)).toHaveAttribute('data-card-id', '')
  await expect(trayCards(page)).toHaveCount(1)
  await expect(modes(page).getByRole('button', { name: 'Ablage (1)' })).toBeVisible()
  // it still counts as a card of the binder
  await expect(page.getByTestId('progress')).toContainText('3')

  // the selected card by a button, then the rest of the page at once
  await pocket(page, 2).click()
  await column.getByRole('button', { name: 'Markierte ablegen' }).click()
  await expect(trayCards(page)).toHaveCount(2)
  await column.getByRole('button', { name: 'Seite 1 ablegen' }).click()
  expect(await ids(trayCards(page))).toEqual(['sv03.5-001', 'sv03.5-004', 'sv03.5-007'])
  await expect(column.getByRole('button', { name: 'Seite 1 ablegen' })).toBeDisabled()

  // they stay there when the binder is left, and the search is back as it was
  await page.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await page.getByRole('button', { name: 'Kanto öffnen' }).click()
  await expect(modes(page).getByRole('button', { name: 'Ablage (3)' })).toBeVisible()
  await expect(column.getByTestId('search-results').getByTestId('card-tile')).toHaveCount(207)
  await page.reload()
  await modes(page).getByRole('button', { name: 'Ablage (3)' }).click()

  // back into a pocket by dragging
  await drag(page, trayCards(page).first().locator('img'), pocket(page, 5))
  await expect(pocket(page, 5)).toHaveAttribute('data-card-id', 'sv03.5-001')
  expect(await ids(trayCards(page))).toEqual(['sv03.5-004', 'sv03.5-007'])
  // onto an occupied pocket: the card there takes its place in the tray
  await drag(page, trayCards(page).first().locator('img'), pocket(page, 5))
  await expect(pocket(page, 5)).toHaveAttribute('data-card-id', 'sv03.5-004')
  expect(await ids(trayCards(page))).toEqual(['sv03.5-001', 'sv03.5-007'])

  // laying aside can be taken back like everything else
  await page.keyboard.press('Control+z')
  await expect(pocket(page, 5)).toHaveAttribute('data-card-id', 'sv03.5-001')
  expect(await ids(trayCards(page))).toEqual(['sv03.5-004', 'sv03.5-007'])

  // a card can be taken out of the binder altogether
  await trayCards(page).first().hover()
  await trayCards(page).first().getByRole('button', { name: 'Glumanda aus dem Binder nehmen' }).click()
  await expect(modes(page).getByRole('button', { name: 'Ablage (1)' })).toBeVisible()

  // back to arranging: the search again
  await modes(page).getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(column.getByRole('searchbox')).toBeVisible()
  await expect(modes(page).getByRole('button', { name: 'Ablage (1)' })).toHaveAttribute('aria-pressed', 'false')
})

test('the selection lays its card aside, one or several', async ({ page }) => {
  await binderWithThreeCards(page)
  const right = page.getByTestId('column-right')

  await pocket(page, 1).click()
  await right.getByRole('button', { name: 'In die Ablage' }).click()
  await expect(pocket(page, 1)).toHaveAttribute('data-card-id', '')
  await expect(modes(page).getByRole('button', { name: 'Ablage (1)' })).toBeVisible()

  await pocket(page, 2).click()
  await pocket(page, 3).click({ modifiers: ['Control'] })
  await right.getByTestId('multi-selection').getByRole('button', { name: 'In die Ablage' }).click()
  await expect(modes(page).getByRole('button', { name: 'Ablage (3)' })).toBeVisible()
  await expect(pocket(page, 3)).toHaveAttribute('data-card-id', '')
})

test('a card is put into a binder from its info and lands in the tray of that binder', async ({ page }) => {
  await binderWithThreeCards(page)
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-025"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Pikachu' })
  await expect(dialog.getByTestId('card-info-holdings')).toHaveText('Noch in keinem Binder')

  await dialog.getByRole('combobox', { name: 'Zu Binder hinzufügen' }).selectOption({ label: 'Kanto' })

  await expect(dialog.getByRole('status').filter({ hasText: 'Ablage' })).toHaveText('Liegt jetzt in der Ablage von „Kanto“.')
  await expect(dialog.getByTestId('card-info-holdings')).toContainText('Kanto · Ablage')
  await expect(dialog.getByTestId('card-info-holdings')).toContainText('1 Exemplar')
  await dialog.getByRole('button', { name: 'Schließen' }).click()

  await page.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await page.getByRole('button', { name: 'Kanto öffnen' }).click()
  await modes(page).getByRole('button', { name: 'Ablage (1)' }).click()
  expect(await ids(trayCards(page))).toEqual(['sv03.5-025'])
})

test('the lists a card is noted on are behind one fold in its info', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByTestId('page').getByRole('button', { name: 'Set', exact: true }).click()
  await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await page.getByTestId('browse-results').locator('[data-card-id="sv03.5-025"]').getByRole('button', { name: /^Infos zu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Pikachu' })
  const lists = dialog.getByTestId('card-info-lists')

  // folded, it says where the card is noted and shows no boxes
  await expect(lists).toContainText(/Merken auf:\s*keiner Liste/)
  await expect(dialog.getByRole('checkbox')).toHaveCount(0)

  await lists.locator('summary').click()
  await dialog.getByRole('checkbox', { name: 'Schnellmerken' }).check()
  await dialog.getByLabel('Name einer neuen Liste').fill('Kaufen')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(lists.locator('summary')).toContainText(/Merken auf:\s*Schnellmerken, Kaufen/)
})

/** Notes the first three cards of "151" on the quick list, from the search beside the binder. */
async function noteThreeCards(page: Page) {
  const column = page.getByTestId('column-left')
  for (const id of ['sv03.5-001', 'sv03.5-004', 'sv03.5-007']) {
    const tile = column.locator(`[data-testid="card-tile"][data-card-id="${id}"]`)
    await tile.hover()
    await tile.getByRole('button', { name: /merken$/ }).click()
  }
  await column.getByRole('tab', { name: /^Merkliste/ }).click()
}

test('a watchlist is searched, put in another order and taken over into a binder as a whole', async ({ page }) => {
  await binderWithThreeCards(page)
  await noteThreeCards(page)
  const column = page.getByTestId('column-left')
  const noted = column.getByTestId('watchlist').getByTestId('card-tile')
  // what was noted last comes first
  expect(await ids(noted)).toEqual(['sv03.5-007', 'sv03.5-004', 'sv03.5-001'])

  await column.getByRole('combobox', { name: 'Reihenfolge' }).selectOption('Nach Name')
  expect(await ids(noted)).toEqual(['sv03.5-001', 'sv03.5-004', 'sv03.5-007'])
  await column.getByRole('combobox', { name: 'Reihenfolge' }).selectOption('Nach Set und Nummer')
  expect(await ids(noted)).toEqual(['sv03.5-001', 'sv03.5-004', 'sv03.5-007'])
  await column.getByRole('combobox', { name: 'Reihenfolge' }).selectOption('Zuletzt gemerkt')

  // by a part of the name, or by the number
  await column.getByRole('searchbox', { name: 'In der Liste suchen' }).fill('glum')
  await expect(noted).toHaveCount(1)
  await expect(column.getByTestId('watchlist').getByRole('status')).toHaveText('1 von 3 Karten')
  await column.getByRole('searchbox', { name: 'In der Liste suchen' }).fill('007')
  expect(await ids(noted)).toEqual(['sv03.5-007'])
  await column.getByRole('searchbox', { name: 'In der Liste suchen' }).fill('')
  await expect(noted).toHaveCount(3)

  // the whole list into the tray of a binder, after asking
  await column.getByRole('combobox', { name: 'In Binder übernehmen' }).selectOption({ label: 'Kanto' })
  const question = page.getByRole('alertdialog', { name: 'In „Kanto“ übernehmen?' })
  await expect(question).toContainText('Die 3 gezeigten Karten von „Schnellmerken“')
  await question.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(column.getByText('3 Karten liegen jetzt in der Ablage von „Kanto“.')).toBeVisible()
  await expect(modes(page).getByRole('button', { name: 'Ablage (3)' })).toBeVisible()
  // the list keeps its cards
  await expect(noted).toHaveCount(3)

  // in the tray, cards are found by name as well
  await modes(page).getByRole('button', { name: 'Ablage (3)' }).click()
  await column.getByRole('searchbox', { name: 'In der Ablage suchen' }).fill('schig')
  expect(await ids(trayCards(page))).toEqual(['sv03.5-007'])
  await column.getByRole('searchbox', { name: 'In der Ablage suchen' }).fill('zzz')
  await expect(page.getByTestId('tray')).toContainText('Keine abgelegte Karte passt zur Suche.')
})

test('cards of the binder are noted on a watchlist from the selection, one or several', async ({ page }) => {
  await binderWithThreeCards(page)
  const right = page.getByTestId('column-right')
  const column = page.getByTestId('column-left')

  await pocket(page, 1).click()
  await right.getByRole('combobox', { name: 'Auf Merkliste setzen' }).selectOption({ label: 'Schnellmerken' })
  await expect(right.getByText('1 Karte auf „Schnellmerken“ gemerkt.')).toBeVisible()
  await expect(page.getByTestId('saved-count')).toHaveText('1')

  // several at once; the one that is on the list already stays as it is
  await pocket(page, 1).click()
  await pocket(page, 2).click({ modifiers: ['Control'] })
  await pocket(page, 3).click({ modifiers: ['Control'] })
  await right.getByTestId('multi-selection').getByRole('combobox', { name: 'Auf Merkliste setzen' }).selectOption({ label: 'Schnellmerken' })
  await expect(page.getByTestId('saved-count')).toHaveText('3')
  await column.getByRole('tab', { name: /^Merkliste/ }).click()
  await expect(column.getByTestId('watchlist').getByTestId('card-tile')).toHaveCount(3)
  // the cards stay in the binder
  await expect(pocket(page, 1)).toHaveAttribute('data-card-id', 'sv03.5-001')
})

test('a card noted in one language shows that in another', async ({ page }) => {
  await page.goto('/')
  const column = page.getByTestId('column-left')
  const openSet = async () => {
    await column.getByRole('button', { name: 'Set', exact: true }).click()
    await page.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  }
  await openSet()
  // the search, not the list of noted cards behind its tab
  const results = column.getByTestId('search-results')
  const tile = results.locator('[data-card-id="sv03.5-001"]')
  await tile.hover()
  await tile.getByRole('button', { name: 'Bisasam merken' }).click()

  await column.getByRole('combobox', { name: 'Sprache der Karten' }).selectOption('en')
  // not on a list in English, but the star says that it is noted in German
  const star = tile.getByRole('button', { name: 'Bulbasaur merken' })
  await page.mouse.move(700, 400)
  await expect(star).toHaveCSS('opacity', '1')
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expect(star).toHaveAttribute('title', 'Auf Deutsch gemerkt')
  // a card that is noted nowhere shows nothing
  await expect(results.locator('[data-card-id="sv03.5-004"]').getByRole('button', { name: /merken$/ })).toHaveCSS('opacity', '0')

  // the info names the language and the list
  await tile.hover()
  await tile.getByRole('button', { name: 'Infos zu Bulbasaur' }).click()
  await expect(page.getByTestId('card-info-other-lang')).toHaveText('Auf Deutsch gemerkt auf: Schnellmerken.')
})
