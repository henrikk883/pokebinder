import { de } from '../../i18n/de'
import { assetStore } from '../../store/assetStore'
import type { Asset } from '../../types/binder'
import { fileToAsset, UnsupportedImageError } from './upload'

/** Reads the chosen files into the library; returns the new images. */
export async function uploadImages(files: Iterable<File>): Promise<Asset[]> {
  const assets = await Promise.all([...files].map(fileToAsset))
  await assetStore.getState().add(assets)
  return assets
}

export function uploadErrorText(error: unknown): string {
  return error instanceof UnsupportedImageError ? de.images.unsupported : de.images.uploadFailed
}
