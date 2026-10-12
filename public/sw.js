// Keeps card pictures and set logos from TCGdex on this device, so that cards seen once
// still show without a connection. Everything else is left alone: the app itself comes
// from the local server, and card data is cached by the app in IndexedDB.

const CACHE = 'tcgdex-images-v1'
const IMAGE_HOST = 'assets.tcgdex.net'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).host !== IMAGE_HOST) return

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
