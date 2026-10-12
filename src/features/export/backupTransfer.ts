import { binderRepository } from '../../db/binderRepository'
import { assetStore } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import type { Binder } from '../../types/binder'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { Asset } from '../../types/binder'
import { normalizeImages } from '../images/imageModel'
import type { Watchlist } from '../search/watchlist'
import { planImport, type ImportEntry } from './importPlan'
import {
  backupFileName,
  createBackup,
  createFullBackup,
  fullBackupFileName,
  parseAnyBackup,
  referencedAssetIds,
  serializeBackup,
} from './backup'

function download(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Offers the binder with all its images as a JSON download. */
export async function downloadBackup(binder: Binder): Promise<void> {
  const assets = await binderRepository.loadAssets(referencedAssetIds(binder))
  const backup = await createBackup(binder, assets)
  download(serializeBackup(backup), backupFileName(binder.name, backup.exportedAt))
}

const LAST_FULL_BACKUP_KEY = 'pokebinder:last-full-backup'

/** When everything was last saved to a file, as ISO date; `null` if never or unknown. */
export function lastFullBackup(): string | null {
  try {
    return localStorage.getItem(LAST_FULL_BACKUP_KEY)
  } catch {
    return null
  }
}

/** Offers every binder and the whole image library as one JSON download. */
export async function downloadFullBackup(): Promise<void> {
  // a change made a moment ago must be in the file too
  await binderStore.getState().whenSaved()
  const [binders, assets] = await Promise.all([binderRepository.listBinders(), binderRepository.listAssets()])
  const backup = await createFullBackup(binders, assets, undefined, useWatchlistStore.getState().lists)
  download(JSON.stringify(backup), fullBackupFileName(backup.exportedAt))
  try {
    localStorage.setItem(LAST_FULL_BACKUP_KEY, backup.exportedAt)
  } catch {
    // without storage the reminder simply stays
  }
}

/** A backup file that was read but not stored yet. */
export interface PendingImport {
  /** Every binder of the file, compared with what is on this device. */
  entries: ImportEntry[]
  assets: Asset[]
  watchlists?: Watchlist[]
}

/**
 * Reads a backup file (one binder or everything) and compares it with this device, without
 * changing anything yet. Throws `BackupError` when the file cannot be used.
 */
export async function readBackupFile(file: File): Promise<PendingImport> {
  const { binders: parsed, assets, watchlists } = parseAnyBackup(await file.text())
  // a backup edited by hand may place images where they cannot be
  const binders = parsed.map((binder) => normalizeImages(binder))
  // a change made a moment ago must be part of the comparison
  await binderStore.getState().whenSaved()
  const entries = planImport(binders, await binderRepository.listBinders())
  return { entries, assets, ...(watchlists ? { watchlists } : {}) }
}

/**
 * Stores the chosen binders of a file that was read; each replaces the binder with the
 * same id, all others stay as they are. Images and lists of the file are taken in either
 * way: they only add. Returns the binders that were stored.
 */
export async function applyImport(pending: PendingImport, binderIds: readonly string[]): Promise<Binder[]> {
  const binders = pending.entries
    .filter((entry) => binderIds.includes(entry.binder.id))
    .map((entry) => entry.binder)
  await binderStore.getState().whenSaved()
  await binderRepository.saveAssets(pending.assets)
  for (const binder of binders) await binderRepository.saveBinder(binder)
  await assetStore.getState().load()
  if (pending.watchlists) useWatchlistStore.getState().merge(pending.watchlists)
  return binders
}
