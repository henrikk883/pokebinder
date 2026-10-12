/**
 * What lies open when the binder is opened at one place: two facing sides.
 * Page 1 sits alone on the right, next to the inside of the cover; after that
 * pages come in pairs (2–3, 4–5, …). Sides hold page indices, starting at 0.
 */
export interface Spread {
  index: number
  /** `'cover'` for the inside of the cover, `null` where the binder has no page. */
  left: number | 'cover' | null
  right: number | null
}

export function buildSpreads(pageCount: number): Spread[] {
  const spreads: Spread[] = [{ index: 0, left: 'cover', right: pageCount > 0 ? 0 : null }]
  for (let left = 1; left < pageCount; left += 2) {
    spreads.push({
      index: spreads.length,
      left,
      right: left + 1 < pageCount ? left + 1 : null,
    })
  }
  return spreads
}

/** Index of the spread that shows the given page. */
export function spreadOfPage(pageIndex: number): number {
  return Math.floor((pageIndex + 1) / 2)
}

/** Page numbers as printed in the UI (starting at 1), left to right. */
export function pageNumbersOf(spread: Spread): number[] {
  return [spread.left, spread.right].flatMap((side) => (typeof side === 'number' ? [side + 1] : []))
}

export const MIN_ZOOM = 50
export const MAX_ZOOM = 150
export const ZOOM_STEP = 5
export const DEFAULT_ZOOM = 80

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom / ZOOM_STEP) * ZOOM_STEP))
}

export interface Size {
  width: number
  height: number
}

/**
 * The zoom at which the open binder fits into the room it has, never more than the usual
 * one. `spread` is the size of the binder as shown at `zoom`. The result is a step on
 * the way: a binder that is still too large after it gets one more, so asking again with
 * the new size settles on the largest zoom that fits.
 */
export function fitZoom(zoom: number, spread: Size, available: Size): number {
  if (spread.width <= 0 || spread.height <= 0 || available.width <= 0 || available.height <= 0) {
    return zoom
  }
  const ratio = Math.min(available.width / spread.width, available.height / spread.height)
  const target = Math.min(
    DEFAULT_ZOOM,
    Math.max(MIN_ZOOM, Math.floor((zoom * ratio) / ZOOM_STEP) * ZOOM_STEP),
  )
  // too large: at least one step smaller, also where rounding says it would just fit
  if (ratio < 1) return Math.max(MIN_ZOOM, Math.min(target, zoom - ZOOM_STEP))
  return Math.max(zoom, target)
}

export function clampSpread(index: number, spreadCount: number): number {
  return Math.min(Math.max(0, spreadCount - 1), Math.max(0, index))
}
