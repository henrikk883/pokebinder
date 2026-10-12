import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test as base, type Page } from '@playwright/test'

const responsesDir = new URL('../fixtures/tcgdex/responses/', import.meta.url)

/** 1×1 PNG, served for every card image and set logo. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

interface Recording {
  /** Request → file with the recorded response. */
  index: Record<string, string>
  /** English card scans that exist for cards without a German one. */
  englishImages: Set<string>
}

let recorded: Promise<Recording> | undefined

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(new URL(file, responsesDir), 'utf8')) as T
}

function loadRecording(): Promise<Recording> {
  recorded ??= Promise.all([
    readJson<Record<string, string>>('index.json'),
    readJson<string[]>('english-images.json'),
  ]).then(([index, englishImages]) => ({ index, englishImages: new Set(englishImages) }))
  return recorded
}

/** English card scans exist only where recorded; German scans and logos always "exist". */
function imageExists(url: URL, englishImages: Set<string>): boolean {
  const cardImage = /^(.+)\/(?:low|high)\.webp$/.exec(url.href)?.[1]
  if (!cardImage || !url.pathname.startsWith('/en/')) return true
  return englishImages.has(cardImage)
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
  const { index, englishImages } = await loadRecording()
  const state = { requests: [] as string[], offline: false }

  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url())
    // set details are asked for by GraphQL; set and language are named in the query
    const query = url.pathname.endsWith('/graphql')
      ? ((route.request().postDataJSON() as { query?: string } | null)?.query ?? '')
      : undefined
    const key =
      query === undefined
        ? requestKey(url)
        : `graphql:${/@locale\(lang: "([^"]+)"\)/.exec(query)?.[1] ?? '?'}:${/id: "([^"]+)-"/.exec(query)?.[1] ?? '?'}`
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
  await page.route('https://assets.tcgdex.net/**', (route) => {
    if (state.offline) return route.abort('internetdisconnected')
    // like the real server, every answer may be read from any origin
    const headers = { 'access-control-allow-origin': '*' }
    if (!imageExists(new URL(route.request().url()), englishImages)) {
      return route.fulfill({ status: 404, contentType: 'text/plain', headers, body: 'not found' })
    }
    return route.fulfill({ contentType: 'image/png', headers, body: PIXEL })
  })

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
