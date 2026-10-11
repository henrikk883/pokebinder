import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test as base, type Page } from '@playwright/test'

const responsesDir = new URL('../fixtures/tcgdex/responses/', import.meta.url)

/** 1×1 PNG, served for every card image and set logo. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

let recorded: Promise<Record<string, string>> | undefined

function loadIndex(): Promise<Record<string, string>> {
  recorded ??= readFile(new URL('index.json', responsesDir), 'utf8').then(
    (json) => JSON.parse(json) as Record<string, string>,
  )
  return recorded
}

/** `de/cards?name=Glurak&…` for a request to the TCGdex API. */
function requestKey(url: URL): string {
  const path = decodeURIComponent(url.pathname.replace(/^\/v2\//, ''))
  const query = [...url.searchParams].map(([key, value]) => `${key}=${value}`).join('&')
  return query ? `${path}?${query}` : path
}

export interface Tcgdex {
  /** Every API request the app has made, in order. */
  requests: string[]
  /** From now on TCGdex cannot be reached. */
  goOffline: () => void
}

async function mockTcgdex(page: Page): Promise<Tcgdex> {
  const index = await loadIndex()
  const state = { requests: [] as string[], offline: false }

  await page.route('https://api.tcgdex.net/**', async (route) => {
    const key = requestKey(new URL(route.request().url()))
    state.requests.push(key)
    if (state.offline) return route.abort('internetdisconnected')
    const file = index[key]
    if (!file) return route.fulfill({ status: 404, json: { error: `not recorded: ${key}` } })
    return route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      path: fileURLToPath(new URL(file, responsesDir)),
    })
  })
  await page.route('https://assets.tcgdex.net/**', (route) =>
    state.offline
      ? route.abort('internetdisconnected')
      : route.fulfill({ contentType: 'image/png', body: PIXEL }),
  )

  return {
    requests: state.requests,
    goOffline: () => {
      state.offline = true
    },
  }
}

/** Tests never reach the real TCGdex; they replay the recorded responses. */
export const test = base.extend<{ tcgdex: Tcgdex }>({
  tcgdex: [
    async ({ page }, use) => {
      await use(await mockTcgdex(page))
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
