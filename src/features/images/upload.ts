import { newId } from '../../lib/id'
import type { Asset } from '../../types/binder'
import { fitWithin } from './imageModel'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class UnsupportedImageError extends Error {
  constructor() {
    super('Unsupported image')
    this.name = 'UnsupportedImageError'
  }
}

/**
 * Turns an uploaded file into a stored image. Large photos are scaled down so that
 * storage and backup files stay small.
 */
export async function fileToAsset(file: File): Promise<Asset> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new UnsupportedImageError()

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UnsupportedImageError()
  }

  try {
    const size = fitWithin(bitmap.width, bitmap.height)
    let blob: Blob = file
    if (size.width !== bitmap.width || size.height !== bitmap.height) {
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')
      if (!context) throw new UnsupportedImageError()
      context.drawImage(bitmap, 0, 0, size.width, size.height)
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new UnsupportedImageError())),
          file.type,
          0.9,
        )
      })
    }
    return {
      id: newId(),
      blob,
      mimeType: blob.type || file.type,
      width: size.width,
      height: size.height,
      createdAt: new Date().toISOString(),
    }
  } finally {
    bitmap.close()
  }
}
