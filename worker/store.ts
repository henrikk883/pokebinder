/**
 * What the server keeps for each collector, and the rules for changing it. The API talks
 * to this, not to the database: the rules can be tested without one.
 */

/** A binder on record: when it last changed, and whether that change was its deletion. */
export interface BinderRecord {
  id: string
  updatedAt: string
  deleted: boolean
}

export interface AssetRecord {
  id: string
  mimeType: string
  width: number
  height: number
  createdAt?: string
}

/**
 * The answer to a change: taken, or turned away because the server has another version
 * than the device thought (`current` says which; `null` if it has none). A device that is
 * turned away fetches that version and lets the collector decide.
 */
export type WriteResult = { ok: true } | { ok: false; current: BinderRecord | null }

/** A link under which one binder can be looked at by anybody who has it. */
export interface ShareRecord {
  token: string
  binderId: string
  createdAt: string
  /** Whether whoever opens the link is offered to copy the binder into a collection of their own. */
  copyable: boolean
}

export interface SyncStore {
  listBinders(user: string): Promise<BinderRecord[]>
  /** The stored binder as the JSON text it came in; `undefined` if unknown or deleted. */
  getBinder(user: string, id: string): Promise<string | undefined>
  /**
   * Stores a version of a binder. `base` is the `updatedAt` the device last saw on the
   * server (`null`: none): only if that is still what the server has does the new version
   * take its place.
   */
  putBinder(user: string, id: string, updatedAt: string, data: string, base: string | null): Promise<WriteResult>
  /** Records that a binder was deleted, under the same rule as `putBinder`. */
  deleteBinder(user: string, id: string, deletedAt: string, base: string | null): Promise<WriteResult>

  /** Decks are kept exactly like binders, in a list of their own. */
  listDecks(user: string): Promise<BinderRecord[]>
  getDeck(user: string, id: string): Promise<string | undefined>
  putDeck(user: string, id: string, updatedAt: string, data: string, base: string | null): Promise<WriteResult>
  deleteDeck(user: string, id: string, deletedAt: string, base: string | null): Promise<WriteResult>

  getWatchlists(user: string): Promise<{ updatedAt: string; data: string } | undefined>
  /** Stores the lists if the server still has what the device last saw (`base`). */
  putWatchlists(
    user: string,
    updatedAt: string,
    data: string,
    base: string | null,
  ): Promise<{ ok: true } | { ok: false; currentUpdatedAt: string | null }>

  listShares(user: string): Promise<ShareRecord[]>
  /** Makes a link for a binder; a binder that has one keeps it, and that one is returned. */
  createShare(user: string, binderId: string, token: string, createdAt: string): Promise<ShareRecord>
  /** Withdraws a link of this collector; `false` if there was none. */
  deleteShare(user: string, token: string): Promise<boolean>
  /** Says whether a link of this collector offers copying; `false` if there is no such link. */
  setShareCopyable(user: string, token: string, copyable: boolean): Promise<boolean>
  /** Whose binder a link shows; `undefined` for a link that does not exist (any more). */
  findShare(token: string): Promise<{ user: string; binderId: string; copyable: boolean } | undefined>

  listAssets(user: string): Promise<AssetRecord[]>
  getAsset(user: string, id: string): Promise<{ record: AssetRecord; bytes: ArrayBuffer } | undefined>
  /** Stores an image. Images never change once uploaded, so one that is there stays as it is. */
  putAsset(user: string, record: AssetRecord, bytes: ArrayBuffer): Promise<void>
}

/** The rule shared by every write: the device must have seen what the server has. */
export function mayWrite(current: BinderRecord | undefined, base: string | null, incomingUpdatedAt: string): boolean {
  if (!current) return base === null
  // the same change sent twice (a retry after a lost answer) is no conflict
  if (current.updatedAt === incomingUpdatedAt) return true
  return current.updatedAt === base
}
