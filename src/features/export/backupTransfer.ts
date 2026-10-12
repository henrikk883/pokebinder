import { binderRepository } from '../../db/binderRepository'
import { assetStore } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import type { Binder } from '../../types/binder'
import { normalizeImages } from '../images/imageModel'
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
  const backup = await createFullBackup(binders, assets)
  download(JSON.stringify(backup), fullBackupFileName(backup.exportedAt))
  try {
    localStorage.setItem(LAST_FULL_BACKUP_KEY, backup.exportedAt)
  } catch {
    // without storage the reminder simply stays
  }
}

/**
 * Stores what a backup file holds: one binder or everything. Binders with the same id are
 * replaced, all others stay as they are. Returns the binders that were read.
 */
export async function importBackup(file: File): Promise<Binder[]> {
  const { binders: parsed, assets } = parseAnyBackup(await file.text())
  // a backup edited by hand may place images where they cannot be
  const binders = parsed.map((binder) => normalizeImages(binder))
  await binderStore.getState().whenSaved()
  await binderRepository.saveAssets(assets)
  for (const binder of binders) await binderRepository.saveBinder(binder)
  await assetStore.getState().load()
  return binders
}
