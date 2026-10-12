/** Width of an exported binder page in pixels, whatever the zoom on screen. */
export const PAGE_EXPORT_WIDTH = 1500

/** File name for an exported page, e.g. `kanto-collection-seite-4.png`. */
export function pngFileName(binderName: string, page: number): string {
  const slug = binderName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'binder'}-seite-${page}.png`
}

/** How much larger than on screen the image must be drawn to reach the wanted width. */
export function exportScale(elementWidth: number, targetWidth: number): number {
  return elementWidth > 0 ? targetWidth / elementWidth : 1
}

/** CSS selector of the element that shows a page; see `data-export` in the binder components. */
export function exportSelector(page: number): string {
  return `[data-export="page-${page}"]`
}

const FRAME_SELECTOR = '[data-export="spread"]'

/** How long a page may take to show all its cards before it is exported as it is. */
const SETTLE_TIMEOUT_MS = 10_000

/**
 * Waits until a page that was just turned to shows everything: its cards are looked up
 * (`data-pending` gone) and their pictures have loaded or are known to be missing.
 */
export async function pageSettled(page: number, timeoutMs = SETTLE_TIMEOUT_MS): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const element = document.querySelector<HTMLElement>(exportSelector(page))
    if (element) {
      const pending = element.querySelector('[data-pending]') !== null
      const loading = [...element.querySelectorAll('img')].some((image) => !image.complete)
      if ((!pending && !loading) || Date.now() > deadline) return element
    } else if (Date.now() > deadline) {
      throw new Error(`Page ${page} is not shown`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Draws one page of the binder, as it is shown right now, into a PNG and offers it as a
 * download. Buttons are left out (`data-export-hide`); cards marked as missing stay black
 * and white.
 */
export async function downloadPagePng(binderName: string, page: number): Promise<void> {
  const element = await pageSettled(page)
  const frame = document.querySelector<HTMLElement>(FRAME_SELECTOR)

  // the library is large and only needed here, so it is loaded on demand
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(element, {
    pixelRatio: exportScale(element.offsetWidth, PAGE_EXPORT_WIDTH),
    // a page has no background of its own; it takes the binder's
    backgroundColor: getComputedStyle(frame ?? element).backgroundColor,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.exportHide !== undefined),
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = pngFileName(binderName, page)
  link.click()
}

/**
 * Exports several pages, one PNG each. Only the open pages exist on screen, so `showPage`
 * is asked to turn to each page first.
 */
export async function downloadPagePngs(
  binderName: string,
  pages: readonly number[],
  showPage: (page: number) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (const [index, page] of pages.entries()) {
    showPage(page)
    // let the page turn before looking for it
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await downloadPagePng(binderName, page)
    onProgress?.(index + 1, pages.length)
  }
}
