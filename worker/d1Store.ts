import { mayWrite, type AssetRecord, type BinderRecord, type SyncStore, type WriteResult } from './store'
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

  async function currentBinder(user: string, id: string): Promise<BinderRecord | undefined> {
    const row = await db
      .prepare('SELECT id, updated_at, deleted FROM binders WHERE user = ? AND id = ?')
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
    const current = await currentBinder(user, id)
    if (!mayWrite(current, base, updatedAt)) return { ok: false, current: current ?? null }
    await db
      .prepare(
        `INSERT INTO binders (user, id, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user, id) DO UPDATE SET
           updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data`,
      )
      .bind(user, id, updatedAt, data === null ? 1 : 0, data)
      .run()
    return { ok: true }
  }

  return {
    async listBinders(user) {
      await prepared()
      const { results } = await db
        .prepare('SELECT id, updated_at, deleted FROM binders WHERE user = ? ORDER BY id')
        .bind(user)
        .all<BinderRow>()
      return results.map(toRecord)
    },

    async getBinder(user, id) {
      await prepared()
      const row = await db
        .prepare('SELECT data FROM binders WHERE user = ? AND id = ? AND deleted = 0')
        .bind(user, id)
        .first<{ data: string | null }>()
      return row?.data ?? undefined
    },

    putBinder: (user, id, updatedAt, data, base) => write(user, id, updatedAt, data, base),
    deleteBinder: (user, id, deletedAt, base) => write(user, id, deletedAt, null, base),

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
