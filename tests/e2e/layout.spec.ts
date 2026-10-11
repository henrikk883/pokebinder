import { expect, test } from '@playwright/test'

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
