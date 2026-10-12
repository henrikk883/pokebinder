// Keeps card pictures and set logos on this device, so that cards seen once still show
// without a connection. Everything else is left alone: the app itself comes from the local
// server, and card data is cached by the app in IndexedDB.

const CACHE = 'tcgdex-images-v1'
// TCGdex, and pokemontcg.io for the cards TCGdex has no picture of
const IMAGE_HOSTS = new Set(['assets.tcgdex.net', 'images.pokemontcg.io'])

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !IMAGE_HOSTS.has(new URL(request.url).host)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request.url)
      if (cached) return cached
      const response = await fetch(request)
      // only complete, readable answers are worth keeping; a missing picture may appear later
      if (response.ok && response.type !== 'opaque') await cache.put(request.url, response.clone())
      return response
    })(),
  )
})
