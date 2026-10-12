// Keeps card pictures and set logos on this device, so that cards seen once still show
// without a connection. Everything else is left alone: the app itself comes from the local
// server, and card data is cached by the app in IndexedDB.

const CACHE = 'tcgdex-images-v1'
// TCGdex, and pokemontcg.io for the cards TCGdex has no picture of
const IMAGE_HOSTS = new Set(['assets.tcgdex.net', 'images.pokemontcg.io'])

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

/** Keeps a complete answer for later, without holding up whoever waits for the picture. */
function keep(event, cache, url, response) {
  if (!response.ok) return
  const copy = response.clone()
  event.waitUntil(cache.put(url, copy).catch(() => undefined))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !IMAGE_HOSTS.has(new URL(request.url).host)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
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
    })(),
  )
})
