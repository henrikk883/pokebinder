import { DatabaseSync } from 'node:sqlite'
import type { D1Database, D1Statement, R2Bucket } from './types'

/**
 * For tests: a database that understands the same SQL as Cloudflare's (both are SQLite),
 * kept in memory, behind the few calls the store makes.
 */
export function createTestDatabase(): D1Database {
  const sqlite = new DatabaseSync(':memory:')

  function statement(sql: string, values: (string | number | null)[] = []): D1Statement {
    return {
      bind: (...bound) => statement(sql, bound),
      first: <T>() => Promise.resolve((sqlite.prepare(sql).get(...values) as T | undefined) ?? null),
      all: <T>() => Promise.resolve({ results: sqlite.prepare(sql).all(...values) as T[] }),
      run: () => Promise.resolve(sqlite.prepare(sql).run(...values)),
    }
  }

  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      for (const entry of statements) await entry.run()
    },
  }
}

/** For tests: a bucket that keeps its objects in memory. */
export function createTestBucket(): R2Bucket & { keys: () => string[] } {
  const objects = new Map<string, { bytes: ArrayBuffer; contentType?: string }>()
  return {
    keys: () => [...objects.keys()],
    get: (key) => {
      const object = objects.get(key)
      if (!object) return Promise.resolve(null)
      return Promise.resolve({
        ...(object.contentType === undefined ? {} : { httpMetadata: { contentType: object.contentType } }),
        arrayBuffer: () => Promise.resolve(object.bytes),
      })
    },
    put: (key, value, options) => {
      const contentType = options?.httpMetadata?.contentType
      objects.set(key, contentType === undefined ? { bytes: value } : { bytes: value, contentType })
      return Promise.resolve(undefined)
    },
  }
}
