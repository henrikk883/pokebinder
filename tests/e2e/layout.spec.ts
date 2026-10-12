import { expect, test } from './fixtures'

test('shows the three-column layout in the dark theme', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('column-left')
  const center = page.getByTestId('column-center')
  const right = page.getByTestId('column-right')

  await expect(left).toBeVisible()
  await expect(center).toBeVisible()
  await expect(right).toBeVisible()

  const leftBox = await left.boundingBox()
  const centerBox = await center.boundingBox()
  const rightBox = await right.boundingBox()
  if (!leftBox || !centerBox || !rightBox) throw new Error('Columns have no bounding box')

  // side by side, in order, with the binder column taking the most room
  expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(centerBox.x + 1)
  expect(centerBox.x + centerBox.width).toBeLessThanOrEqual(rightBox.x + 1)
  expect(centerBox.width).toBeGreaterThan(leftBox.width)
  expect(centerBox.width).toBeGreaterThan(rightBox.width)
  expect(Math.abs(leftBox.y - centerBox.y)).toBeLessThan(1)
  expect(Math.abs(rightBox.y - centerBox.y)).toBeLessThan(1)

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const channels = background.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? []
  expect(channels).toHaveLength(3)
  for (const channel of channels) expect(channel).toBeLessThan(40)

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalScroll).toBe(false)

  await expect(page.getByRole('contentinfo')).toContainText('The Pokémon Company')
})

test('both outer columns fold away on any screen; the choice is remembered', async ({ page }) => {
  await page.goto('/')
  const left = page.getByTestId('column-left')
  const right = page.getByTestId('column-right')
  const centreWidth = async () => (await page.getByTestId('column-center').boundingBox())?.width

  // a wide screen starts with all three columns
  await expect(left).toBeVisible()
  await expect(right).toBeVisible()
  expect(await centreWidth()).toBeCloseTo(1440 - 600, 0)

  await page.getByRole('button', { name: 'Auswahl ausblenden' }).click()
  await expect(right).toBeHidden()
  expect(await centreWidth()).toBeCloseTo(1440 - 300, 0)

  await page.getByRole('button', { name: 'Suche ausblenden' }).click()
  await expect(left).toBeHidden()
  expect(await centreWidth()).toBeCloseTo(1440, 0)

  // still folded away after a reload
  await page.reload()
  await expect(page.getByRole('button', { name: 'Suche einblenden' })).toBeVisible()
  await expect(left).toBeHidden()
  await expect(right).toBeHidden()

  // the selection comes back beside the binder, not over it
  await page.getByRole('button', { name: 'Auswahl einblenden' }).click()
  await expect(right).toBeVisible()
  expect(await centreWidth()).toBeCloseTo(1440 - 300, 0)
  await page.getByRole('button', { name: 'Suche einblenden' }).click()
  expect(await centreWidth()).toBeCloseTo(1440 - 600, 0)
})
