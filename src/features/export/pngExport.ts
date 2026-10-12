/** Width of an exported double page in pixels; a single page gets half of it. */
export const SPREAD_EXPORT_WIDTH = 3000

/** What to export: both open sides, or one page by its number. */
export type PngTarget = { kind: 'spread'; pages: number[] } | { kind: 'page'; page: number }

/** File name for an exported image, e.g. `kanto-collection-seiten-2-3.png`. */
export function pngFileName(binderName: string, target: PngTarget): string {
  const slug = binderName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const pages = target.kind === 'page' ? [target.page] : target.pages
  const part =
    pages.length === 0 ? 'cover' : `${pages.length === 1 ? 'seite' : 'seiten'}-${pages.join('-')}`
  return `${slug || 'binder'}-${part}.png`
}

/** How much larger than on screen the image must be drawn to reach the wanted width. */
export function exportScale(elementWidth: number, targetWidth: number): number {
  return elementWidth > 0 ? targetWidth / elementWidth : 1
}

/** CSS selector of the element that shows the target; see `data-export` in the binder components. */
export function exportSelector(target: PngTarget): string {
  return target.kind === 'spread' ? '[data-export="spread"]' : `[data-export="page-${target.page}"]`
}

/**
 * Draws the open binder, or one page of it, into a PNG and offers it as a download.
 * The image has a fixed width, whatever the zoom on screen. Buttons are left out
 * (`data-export-hide`); cards marked as missing stay black and white.
 */
export async function downloadPng(binderName: string, target: PngTarget): Promise<void> {
  const element = document.querySelector<HTMLElement>(exportSelector(target))
  if (!element) throw new Error('Nothing to export')
  const frame = document.querySelector<HTMLElement>(exportSelector({ kind: 'spread', pages: [] }))
  const width = target.kind === 'spread' ? SPREAD_EXPORT_WIDTH : SPREAD_EXPORT_WIDTH / 2

  // the library is large and only needed here, so it is loaded on demand
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(element, {
    pixelRatio: exportScale(element.offsetWidth, width),
    // a single page has no background of its own; it takes the binder's
    backgroundColor: getComputedStyle(frame ?? element).backgroundColor,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.exportHide !== undefined),
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = pngFileName(binderName, target)
  link.click()
}
