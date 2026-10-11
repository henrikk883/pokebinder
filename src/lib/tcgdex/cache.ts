import type { PokeBinderDatabase } from '../../db/database'

export interface CachedResponse {
  key: string
  value: unknown
  fetchedAt: number
}

export interface ResponseCacheOptions {
  maxAgeMs: number
  now?: () => number
}

export interface ResponseCache {
  /**
   * Returns the stored value while it is fresh, otherwise loads and stores a new one.
   * If loading fails, an outdated value is still better than none (offline use).
   */
  fetch<T>(key: string, load: () => Promise<T>): Promise<T>
}

export function createResponseCache(
  database: PokeBinderDatabase,
  { maxAgeMs, now = Date.now }: ResponseCacheOptions,
): ResponseCache {
  const inFlight = new Map<string, Promise<unknown>>()

  // Storage may be unavailable (private mode, quota); the app then works without a cache.
  async function read(key: string): Promise<CachedResponse | undefined> {
    try {
      return await database.apiCache.get(key)
    } catch {
      return undefined
    }
  }

  async function write(entry: CachedResponse): Promise<void> {
    try {
      await database.apiCache.put(entry)
    } catch {
      // see above
    }
  }

  async function resolve<T>(key: string, load: () => Promise<T>): Promise<T> {
    const entry = await read(key)
    if (entry && now() - entry.fetchedAt < maxAgeMs) return entry.value as T
    try {
      const value = await load()
      await write({ key, value, fetchedAt: now() })
      return value
    } catch (error) {
      if (entry) return entry.value as T
      throw error
    }
  }

  return {
    fetch<T>(key: string, load: () => Promise<T>): Promise<T> {
      const running = inFlight.get(key)
      if (running) return running as Promise<T>
      const promise = resolve(key, load).finally(() => inFlight.delete(key))
      inFlight.set(key, promise)
      return promise
    },
  }
}
