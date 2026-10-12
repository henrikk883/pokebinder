import type { CSSProperties } from 'react'
import type { ImageCrop } from '../../types/binder'

/** Gap between pockets in --u (one pixel at 100 % zoom); the pocket grid uses the same value. */
export const POCKET_GAP_UNITS = 8

/** How an image fills its area for a given crop. */
export function cropStyle(crop: ImageCrop): CSSProperties {
  const focus = `${crop.x * 100}% ${crop.y * 100}%`
  return {
    objectFit: 'cover',
    objectPosition: focus,
    transform: `scale(${crop.zoom})`,
    transformOrigin: focus,
  }
}
