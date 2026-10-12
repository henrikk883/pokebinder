import { binderRepository } from '../../db/binderRepository'
import { assetStore } from '../../store/assetStore'
import type { Binder } from '../../types/binder'
import { normalizeImages } from '../images/imageModel'
import {
  backupFileName,
  createBackup,
  parseBackup,
  referencedAssetIds,
  serializeBackup,
} from './backup'

/** Offers the binder with all its images as a JSON download. */
export async function downloadBackup(binder: Binder): Promise<void> {
  const assets = await binderRepository.loadAssets(referencedAssetIds(binder))
  const backup = await createBackup(binder, assets)
  const url = URL.createObjectURL(
    new Blob([serializeBackup(backup)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(binder.name, backup.exportedAt)
  link.click()
  URL.revokeObjectURL(url)
}

/** Stores the binder from a backup file, replacing a binder with the same id. */
export async function importBackup(file: File): Promise<Binder> {
  const { binder: parsed, assets } = parseBackup(await file.text())
  // a backup edited by hand may place images where they cannot be
  const binder = normalizeImages(parsed)
  await binderRepository.saveBinderWithAssets(binder, assets)
  await assetStore.getState().load()
  return binder
}
