import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function createMasterSet(page: Page) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByText('Master Set', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Set', exact: true }).click()
  await dialog.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await expect(dialog.getByTestId('master-set-summary')).toBeVisible()
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: '151', exact: true })).toBeVisible()
}

async function toShelf(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Meine Karten' }).click()
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
}

test('a wish price is set for a noted card; the list says when the card can be had for it', async ({ page }) => {
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Set', exact: true }).click()
  await main.getByRole('listbox', { name: 'Set' }).getByRole('option', { name: /^151/ }).click()
  await page.getByRole('button', { name: 'Bisasam merken' }).first().click()
  await page.getByRole('button', { name: 'Bisaknosp merken' }).first().click()
  await main.getByRole('tab', { name: /^Merkliste/ }).click()
  const list = page.getByTestId('browse-watchlist')
  const bisasam = list.locator('[data-card-id="sv03.5-001"]')

  // nothing is watched until a price is set, and only that card is
  await expect(list.getByTestId('wish-price')).toHaveCount(0)
  await bisasam.getByRole('button', { name: 'Wunschpreis setzen' }).click()
  const dialog = page.getByRole('dialog', { name: 'Wunschpreis für Bisasam' })
  await dialog.getByRole('textbox').fill('100')
  await dialog.getByRole('button', { name: 'Merken' }).click()

  const wish = bisasam.getByTestId('wish-price')
  await expect(wish).toContainText('Wunsch: 100,00 €')
  // Bisasam costs far less than that
  await expect(wish).toHaveAttribute('data-reached', 'true')
  await expect(wish).toContainText(/Jetzt [0-9.,]+ €/)
  await expect(list.getByTestId('wish-price')).toHaveCount(1)
  // the tab says how many cards are there for the taking
  await expect(main.getByRole('tab', { name: /^Merkliste/ })).toHaveText(/21$/)

  // a wish below what the card costs: watched, not reached
  await wish.getByRole('button', { name: /^Wunsch:/ }).click()
  await dialog.getByRole('textbox').fill('0,01')
  await dialog.getByRole('button', { name: 'Merken' }).click()
  await expect(wish).toHaveAttribute('data-reached', 'false')
  await expect(wish).toContainText(/aktuell [0-9.,]+ €/)
  await expect(main.getByRole('tab', { name: /^Merkliste/ })).toHaveText(/2$/)

  // what is typed must be an amount
  await wish.getByRole('button', { name: /^Wunsch:/ }).click()
  await dialog.getByRole('textbox').fill('billig')
  await dialog.getByRole('button', { name: 'Merken' }).click()
  await expect(wish).toContainText('Wunsch: 0,01 €')

  // the wish is kept with the list
  await page.reload()
  await page.getByRole('banner').getByRole('button', { name: 'Karten stöbern' }).click()
  await page.getByRole('main').getByRole('tab', { name: /^Merkliste/ }).click()
  await expect(page.getByTestId('browse-watchlist').getByTestId('wish-price')).toContainText('Wunsch: 0,01 €')

  await page.getByRole('button', { name: 'Wunschpreis für Bisasam entfernen' }).click()
  await expect(page.getByTestId('browse-watchlist').getByTestId('wish-price')).toHaveCount(0)
})

test('the shelf keeps track of what the collection was worth and shows how that went', async ({ page }) => {
  await createMasterSet(page)
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Sammlung' }).click()
  const first = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket').first()
  await first.click()
  await expect(first).toHaveAttribute('data-owned', 'true')
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()
  await toShelf(page)
  await expect(page.getByTestId('binder-worth')).toHaveText(/€$/)

  // the first day: a history is there, but one day makes no line
  await page.getByRole('button', { name: 'Wertverlauf' }).click()
  const dialog = page.getByRole('dialog', { name: 'Wertverlauf' })
  await expect(dialog).toContainText('Noch zu früh für eine Linie')
  await expect(page.getByTestId('shelf-change')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  const today = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem('pokebinder:value-history') ?? '[]') as { date: string }[]
    return history.map((point) => point.date)
  })
  expect(today).toEqual([new Date().toISOString().slice(0, 10)])

  // as if the shelf had been looked at before, when the collection was worth one euro
  await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem('pokebinder:value-history') ?? '[]') as unknown[]
    const earlier = [
      { date: '2026-01-05', binders: { earlier: 1 } },
      { date: '2026-03-09', binders: { earlier: 0.5 } },
    ]
    localStorage.setItem('pokebinder:value-history', JSON.stringify([...earlier, ...history]))
  })
  await page.reload()
  await toShelf(page)

  // today's worth is below that euro
  await expect(page.getByTestId('shelf-change')).toHaveText(/^−0,[0-9]{2} € seit 05\.01\.2026$/)
  await page.getByRole('button', { name: 'Wertverlauf' }).click()
  await expect(dialog.getByTestId('value-chart')).toBeVisible()
  await expect(dialog.getByTestId('value-chart').locator('polyline')).toHaveAttribute('points', /^([0-9.]+,[0-9.]+ ){2}[0-9.]+,[0-9.]+$/)
  await expect(dialog).toContainText('05.01.2026: 1,00 €')
  // one binder alone: it has been noted on one day only
  await dialog.getByRole('combobox', { name: 'Verlauf von' }).selectOption({ label: '151' })
  await expect(dialog).toContainText('Noch zu früh für eine Linie')
})
