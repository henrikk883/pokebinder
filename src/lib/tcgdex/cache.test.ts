// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PokeBinderDatabase } from '../../db/database'
import { createResponseCache, type ResponseCache } from './cache'

const HOUR = 60 * 60 * 1000

let database: PokeBinderDatabase
let cache: ResponseCache
let time: number
let counter = 0

beforeEach(() => {
  database = new PokeBinderDatabase(`pokebinder-cache-test-${++counter}`)
  time = Date.UTC(2026, 9, 12)
  cache = createResponseCache(database, { maxAgeMs: 24 * HOUR, now: () => time })
})

afterEach(async () => {
  await database.delete()
})

describe('response cache', () => {
  it('loads a value once and answers the second call without the network', async () => {
    const load = vi.fn(async () => ['Glurak'])

    expect(await cache.fetch('de/cards?name=Glurak', load)).toEqual(['Glurak'])
    expect(await cache.fetch('de/cards?name=Glurak', load)).toEqual(['Glurak'])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps values across a reload', async () => {
    await cache.fetch('de/sets', async () => ['sv01'])
    const afterReload = createResponseCache(database, { maxAgeMs: 24 * HOUR, now: () => time })
    const load = vi.fn(async () => ['changed'])

    expect(await afterReload.fetch('de/sets', load)).toEqual(['sv01'])
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps different keys apart', async () => {
    await cache.fetch('de/sets/sv01', async () => 'one')

    expect(await cache.fetch('de/sets/sv02', async () => 'two')).toBe('two')
    expect(await cache.fetch('de/sets/sv01', async () => 'other')).toBe('one')
  })

  it('loads again once the value is older than the maximum age', async () => {
    await cache.fetch('de/sets', async () => ['old'])

    time += 25 * HOUR

    expect(await cache.fetch('de/sets', async () => ['new'])).toEqual(['new'])
    expect(await cache.fetch('de/sets', async () => ['newer'])).toEqual(['new'])
  })

  it('falls back to an outdated value when loading fails (offline)', async () => {
    await cache.fetch('de/sets', async () => ['old'])
    time += 25 * HOUR

    const offline = () => Promise.reject(new Error('offline'))

    expect(await cache.fetch('de/sets', offline)).toEqual(['old'])
  })

  it('reports the failure when there is nothing stored, and stores nothing', async () => {
    await expect(cache.fetch('de/sets', () => Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline',
    )

    expect(await cache.fetch('de/sets', async () => ['later'])).toEqual(['later'])
  })

  it('shares one request between simultaneous calls', async () => {
    const load = vi.fn(async () => ['sv01'])

    const results = await Promise.all([cache.fetch('de/sets', load), cache.fetch('de/sets', load)])

    expect(results).toEqual([['sv01'], ['sv01']])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('still answers when the database cannot be used', async () => {
    database.close()
    const broken = new PokeBinderDatabase(database.name)
    vi.spyOn(broken.apiCache, 'get').mockRejectedValue(new Error('no storage'))
    vi.spyOn(broken.apiCache, 'put').mockRejectedValue(new Error('no storage'))
    const withoutStorage = createResponseCache(broken, { maxAgeMs: HOUR })

    expect(await withoutStorage.fetch('de/sets', async () => ['sv01'])).toEqual(['sv01'])
    broken.close()
  })
})
