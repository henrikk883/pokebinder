import { expect, test } from './fixtures'

// What a phone or a browser needs to offer "Zum Startbildschirm hinzufügen" and to open
// the app like one. That it opens without a connection is the service worker's doing,
// which only the built app has (see public/sw.js); these tests run without it.

test('the app says how it wants to be installed: name, colours, standalone, its icons', async ({ page }) => {
  await page.goto('/')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.webmanifest')
  const manifest = (await (await page.request.get(href ?? '')).json()) as {
    name: string
    display: string
    start_url: string
    background_color: string
    icons: { src: string; sizes: string; type: string; purpose: string }[]
  }
  expect(manifest).toMatchObject({ name: 'PokéBinder', display: 'standalone', start_url: '/', background_color: '#0a0d16' })
  // a large icon for the splash screen, a small one for the home screen, one that may be cropped
  expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
    '192x192 any',
    '512x512 any',
    '512x512 maskable',
  ])

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  for (const src of [...manifest.icons.map((icon) => icon.src), apple ?? '']) {
    const response = await page.request.get(src)
    expect(response.status(), src).toBe(200)
    expect(response.headers()['content-type'], src).toBe('image/png')
    // a PNG of the size it claims
    const file = await response.body()
    const size = manifest.icons.find((icon) => icon.src === src)?.sizes ?? '180x180'
    expect(`${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`, src).toBe(size)
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#10141f')
})
