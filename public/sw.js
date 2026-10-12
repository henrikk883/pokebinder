// Keeps what the app needs to open without a connection on this device: the app itself
// (page, scripts, styles) and the card pictures and set logos seen so far. Card data is
// cached by the app in IndexedDB. The server part under /api/ is never touched.

const IMAGES = 'tcgdex-images-v1'
const APP = 'app-v1'
// TCGdex, and pokemontcg.io for the cards TCGdex has no picture of
const IMAGE_HOSTS = new Set(['assets.tcgdex.net', 'images.pokemontcg.io'])
/** How long the page may take to arrive before the kept one is shown instead. */
const PAGE_TIMEOUT_MS = 4000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/**
 * A picture in a form that may be kept and read (for the PNG export, the PDFs). TCGdex
 * sends its permission for that twice on some answers, which browsers take as none at
 * all; whether an answer is usable is a matter of luck, so it is asked for again. Past the
 * browser's own cache from the second attempt on: that would hand back the same answer.
 */
async function readable(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetch(url, { mode: 'cors', credentials: 'omit', cache: attempt === 0 ? 'default' : 'reload' })
    } catch {
      // unusable this time, or no connection
    }
  }
  return undefined
}

/** Keeps a complete answer for later, without holding up whoever waits for it. */
function keep(event, cache, url, response) {
  if (!response.ok) return
  const copy = response.clone()
  event.waitUntil(cache.put(url, copy).catch(() => undefined))
}

async function picture(event) {
  const { request } = event
  const cache = await caches.open(IMAGES)
  const cached = await cache.match(request.url)
  if (cached) return cached

  // A picture that is only to be shown must not wait for luck: one attempt at a
  // keepable answer, then it is shown as the browser would show it anyway, and the
  // keepable one is fetched behind the scenes.
  const showOnly = request.mode === 'no-cors'
  const response = await readable(request.url, showOnly ? 1 : 5)
  if (response) {
    keep(event, cache, request.url, response)
    return response
  }
  if (showOnly) {
    event.waitUntil(
      readable(request.url, 4).then((later) => {
        if (later) keep(event, cache, request.url, later)
      }),
    )
  }
  return fetch(request)
}

/** The scripts and styles a page names; their names change with every version of the app. */
const partsOf = (html) => [...new Set(html.match(/\/assets\/[\w.-]+/g) ?? [])]

/**
 * Keeps the page that just arrived together with its scripts and styles. A new version of
 * the app replaces the parts of the old one, so they do not pile up.
 */
async function keepPage(cache, response) {
  const html = await response.text()
  const before = await cache.match('/')
  if (before && (await before.text()) !== html) {
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.startsWith('/assets/')) await cache.delete(request)
    }
  }
  await cache.put('/', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
  await Promise.all(
    partsOf(html).map(async (part) => {
      if (!(await cache.match(part))) await cache.add(part).catch(() => undefined)
    }),
  )
}

/** The page itself: the current one whenever it can be had in time, else the kept one. */
async function page(event) {
  const cache = await caches.open(APP)
  const fresh = fetch(event.request).then((response) => {
    if (response.ok && response.type === 'basic') event.waitUntil(keepPage(cache, response.clone()).catch(() => undefined))
    return response
  })
  const kept = await cache.match('/')
  if (!kept) return fresh
  // without an answer in time the app opens as it was last time
  const late = new Promise((resolve) => setTimeout(() => resolve(undefined), PAGE_TIMEOUT_MS))
  const first = await Promise.race([fresh.catch(() => undefined), late])
  return first && first.ok ? first : kept
}

/** A file of the app: kept ones are used as they are, others are fetched and kept. */
async function part(event) {
  const cache = await caches.open(APP)
  const kept = await cache.match(event.request.url)
  // the name of a script or style changes with its content, so a kept one is never stale
  const immutable = new URL(event.request.url).pathname.startsWith('/assets/')
  if (kept && immutable) return kept
  try {
    const response = await fetch(event.request)
    if (response.type === 'basic') keep(event, cache, event.request.url, response)
    return response
  } catch (error) {
    if (kept) return kept
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (IMAGE_HOSTS.has(url.host)) {
    event.respondWith(picture(event))
    return
  }
  // Only the app's own files; signing in and the sync go straight to the server.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) {
    return
  }
  if (request.mode === 'navigate') event.respondWith(page(event))
  else if (url.pathname !== '/sw.js') event.respondWith(part(event))
})
