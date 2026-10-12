import {
  mayWrite,
  type AssetRecord,
  type BinderRecord,
  type ShareRecord,
  type SyncStore,
  type WriteResult,
} from './store'
import type { D1Database, R2Bucket } from './types'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS binders (
     user TEXT NOT NULL,
     id TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     data TEXT,
     PRIMARY KEY (user, id)
   )`,
  `CREATE TABLE IF NOT EXISTS decks (
     user TEXT NOT NULL,
     id TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     data TEXT,
     PRIMARY KEY (user, id)
   )`,
  `CREATE TABLE IF NOT EXISTS shares (
     token TEXT PRIMARY KEY,
     user TEXT NOT NULL,
     binder_id TEXT NOT NULL,
     created_at TEXT NOT NULL,
     UNIQUE (user, binder_id)
   )`,
  `CREATE TABLE IF NOT EXISTS watchlists (
     user TEXT PRIMARY KEY,
     updated_at TEXT NOT NULL,
     data TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS assets (
     user TEXT NOT NULL,
     id TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     width INTEGER NOT NULL,
     height INTEGER NOT NULL,
     created_at TEXT,
     PRIMARY KEY (user, id)
   )`,
]

interface BinderRow {
  id: string
  updated_at: string
  deleted: number
}

interface AssetRow {
  id: string
  mime_type: string
  width: number
  height: number
  created_at: string | null
}

interface ShareRow {
  token: string
  binder_id: string
  created_at: string
}

const toShare = (row: ShareRow): ShareRecord => ({ token: row.token, binderId: row.binder_id, createdAt: row.created_at })

const toRecord = (row: BinderRow): BinderRecord => ({ id: row.id, updatedAt: row.updated_at, deleted: row.deleted === 1 })

function toAsset(row: AssetRow): AssetRecord {
  const record: AssetRecord = { id: row.id, mimeType: row.mime_type, width: row.width, height: row.height }
  if (row.created_at !== null) record.createdAt = row.created_at
  return record
}

/** Images lie in the bucket under the collector and their id. */
const imageKey = (user: string, id: string) => `${user}/${id}`

/**
 * The store in Cloudflare's database (D1), with the images in a bucket (R2). The tables
 * are made on first use, so that nothing has to be set up by hand.
 */
export function createD1Store(db: D1Database, images: R2Bucket): SyncStore {
  let ready: Promise<unknown> | undefined
  const prepared = () => (ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))))

  /** Binders and decks are kept the same way, each in a table of its own. */
  function records(table: 'binders' | 'decks') {
    async function current(user: string, id: string): Promise<BinderRecord | undefined> {
      const row = await db
        .prepare(`SELECT id, updated_at, deleted FROM ${table} WHERE user = ? AND id = ?`)
        .bind(user, id)
        .first<BinderRow>()
      return row ? toRecord(row) : undefined
    }

    async function write(
      user: string,
      id: string,
      updatedAt: string,
      data: string | null,
      base: string | null,
    ): Promise<WriteResult> {
      await prepared()
      const known = await current(user, id)
      if (!mayWrite(known, base, updatedAt)) return { ok: false, current: known ?? null }
      await db
        .prepare(
          `INSERT INTO ${table} (user, id, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user, id) DO UPDATE SET
             updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data`,
        )
        .bind(user, id, updatedAt, data === null ? 1 : 0, data)
        .run()
      return { ok: true }
    }

    return {
      async list(user: string): Promise<BinderRecord[]> {
        await prepared()
        const { results } = await db
          .prepare(`SELECT id, updated_at, deleted FROM ${table} WHERE user = ? ORDER BY id`)
          .bind(user)
          .all<BinderRow>()
        return results.map(toRecord)
      },

      async get(user: string, id: string): Promise<string | undefined> {
        await prepared()
        const row = await db
          .prepare(`SELECT data FROM ${table} WHERE user = ? AND id = ? AND deleted = 0`)
          .bind(user, id)
          .first<{ data: string | null }>()
        return row?.data ?? undefined
      },

      write,
    }
  }

  const binders = records('binders')
  const decks = records('decks')

  return {
    listBinders: binders.list,
    getBinder: binders.get,
    putBinder: (user, id, updatedAt, data, base) => binders.write(user, id, updatedAt, data, base),
    deleteBinder: (user, id, deletedAt, base) => binders.write(user, id, deletedAt, null, base),

    listDecks: decks.list,
    getDeck: decks.get,
    putDeck: (user, id, updatedAt, data, base) => decks.write(user, id, updatedAt, data, base),
    deleteDeck: (user, id, deletedAt, base) => decks.write(user, id, deletedAt, null, base),

    async getWatchlists(user) {
      await prepared()
      const row = await db
        .prepare('SELECT updated_at, data FROM watchlists WHERE user = ?')
        .bind(user)
        .first<{ updated_at: string; data: string }>()
      return row ? { updatedAt: row.updated_at, data: row.data } : undefined
    },

    async putWatchlists(user, updatedAt, data, base) {
      await prepared()
      const row = await db
        .prepare('SELECT updated_at FROM watchlists WHERE user = ?')
        .bind(user)
        .first<{ updated_at: string }>()
      const current = row?.updated_at ?? null
      if (current !== base && current !== updatedAt) return { ok: false, currentUpdatedAt: current }
      await db
        .prepare(
          `INSERT INTO watchlists (user, updated_at, data) VALUES (?, ?, ?)
           ON CONFLICT (user) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data`,
        )
        .bind(user, updatedAt, data)
        .run()
      return { ok: true }
    },

    async listShares(user) {
      await prepared()
      const { results } = await db
        .prepare('SELECT token, binder_id, created_at FROM shares WHERE user = ? ORDER BY created_at')
        .bind(user)
        .all<ShareRow>()
      return results.map(toShare)
    },

    async createShare(user, binderId, token, createdAt) {
      await prepared()
      await db
        .prepare(
          `INSERT INTO shares (token, user, binder_id, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (user, binder_id) DO NOTHING`,
        )
        .bind(token, user, binderId, createdAt)
        .run()
      const row = await db
        .prepare('SELECT token, binder_id, created_at FROM shares WHERE user = ? AND binder_id = ?')
        .bind(user, binderId)
        .first<ShareRow>()
      return row ? toShare(row) : { token, binderId, createdAt }
    },

    async deleteShare(user, token) {
      await prepared()
      const row = await db.prepare('SELECT token FROM shares WHERE user = ? AND token = ?').bind(user, token).first<{ token: string }>()
      if (!row) return false
      await db.prepare('DELETE FROM shares WHERE user = ? AND token = ?').bind(user, token).run()
      return true
    },

    async findShare(token) {
      await prepared()
      const row = await db
        .prepare('SELECT user, binder_id FROM shares WHERE token = ?')
        .bind(token)
        .first<{ user: string; binder_id: string }>()
      return row ? { user: row.user, binderId: row.binder_id } : undefined
    },

    async listAssets(user) {
      await prepared()
      const { results } = await db
        .prepare('SELECT id, mime_type, width, height, created_at FROM assets WHERE user = ? ORDER BY id')
        .bind(user)
        .all<AssetRow>()
      return results.map(toAsset)
    },

    async getAsset(user, id) {
      await prepared()
      const row = await db
        .prepare('SELECT id, mime_type, width, height, created_at FROM assets WHERE user = ? AND id = ?')
        .bind(user, id)
        .first<AssetRow>()
      if (!row) return undefined
      const object = await images.get(imageKey(user, id))
      return object ? { record: toAsset(row), bytes: await object.arrayBuffer() } : undefined
    },

    async putAsset(user, record, bytes) {
      await prepared()
      // the picture first: a record without its picture would be worse than the other way round
      await images.put(imageKey(user, record.id), bytes, { httpMetadata: { contentType: record.mimeType } })
      await db
        .prepare(
          `INSERT INTO assets (user, id, mime_type, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user, id) DO NOTHING`,
        )
        .bind(user, record.id, record.mimeType, record.width, record.height, record.createdAt ?? null)
        .run()
    },
  }
}
