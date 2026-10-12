import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// like someone who opens the site, not like someone who loads it anew
test.use({ landing: true })

const headline = (page: Page) => page.getByRole('heading', { name: 'Deine Karten. Dein Binder. Dein Design.' })
const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

async function createBinder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neuer Binder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Binder' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

test('a visit begins on the start page, which leads to the binders and to the cards', async ({ page }) => {
  await page.goto('/')
  const main = page.getByRole('main')

  await expect(headline(page)).toBeVisible()
  await expect(main.getByRole('heading', { level: 3 })).toHaveText([
    'Master Sets in Sekunden',
    'Gestalte über Grenzen hinweg',
    'Sieh, was noch fehlt',
    'Auf all deinen Geräten',
  ])
  // the drawn binder shows real cards, two pages of nine pockets
  await expect(page.getByTestId('landing-binder').locator('img')).toHaveCount(16)
  await expect(page.getByText('Inoffizielles Fanprojekt')).toBeVisible()

  await main.getByRole('button', { name: /^Karten stöbern/ }).click()
  await expect(page.getByRole('heading', { name: 'Karten stöbern', exact: true })).toBeVisible()

  // the logo leads back, from anywhere
  await page.getByRole('button', { name: 'Startseite' }).click()
  await expect(headline(page)).toBeVisible()

  await main.getByRole('button', { name: /^Meine Karten/ }).click()
  await expect(page.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
})

test('loading the page anew stays in the binder; a new visit offers to go on with it', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: /^Meine Karten/ }).click()
  await createBinder(page, 'Kanto')
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kanto' })).toBeVisible()
  await expect(headline(page)).toHaveCount(0)

  // another tab is another visit
  const visit = await context.newPage()
  await visit.route(/^https:/, (route) => route.abort())
  await visit.goto('/')
  await expect(headline(visit)).toBeVisible()
  // without a connection the pockets of the drawn binder stay empty
  await expect(visit.getByTestId('landing-binder').locator('img')).toHaveCount(0)
  await visit.getByRole('button', { name: 'Weiter mit „Kanto“' }).click()
  await expect(visit.getByRole('heading', { name: 'Kanto' })).toBeVisible()

  // back on the start page, "Meine Karten" means the shelf
  await visit.getByRole('button', { name: 'Startseite' }).click()
  await visit.getByRole('main').getByRole('button', { name: /^Meine Karten/ }).click()
  await expect(visit.getByRole('heading', { name: 'Meine Karten' })).toBeVisible()
  await expect(visit.getByTestId('binder-tile')).toHaveCount(1)
})

test('on a phone the start page stands in one column and fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(headline(page)).toBeVisible()
  expect(await noSidewaysScroll(page)).toBe(true)
  const binders = await page.getByRole('main').getByRole('button', { name: /^Meine Karten/ }).boundingBox()
  const cards = await page.getByRole('main').getByRole('button', { name: /^Stöbern|^Karten stöbern/ }).boundingBox()
  if (!binders || !cards) throw new Error('The two ways in are not visible')
  expect(cards.y).toBeGreaterThan(binders.y + binders.height - 1)
  // both can be reached without scrolling
  expect(cards.y + cards.height).toBeLessThan(844)
  // the header keeps to one line
  expect((await page.getByRole('banner').boundingBox())?.height).toBeLessThan(64)
})
