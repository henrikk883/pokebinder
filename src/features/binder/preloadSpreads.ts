import { useEffect } from 'react'
import { cardImageSources, tcgdexFor } from '../../lib/tcgdex'
import type { Binder, CardRef } from '../../types/binder'
import type { Spread } from './spreads'

/** The cards on the pages of a spread, in no particular order. */
export function cardsOfSpread(binder: Binder, spread: Spread | undefined): CardRef[] {
  if (!spread) return []
  return [spread.left, spread.right].flatMap((side) =>
    typeof side === 'number' ? (binder.pages[side]?.slots ?? []).flatMap((slot) => slot.cardRef ?? []) : [],
  )
}

/** A moment after a page is turned to: whoever leafs through quickly needs nothing fetched. */
const SETTLE_MS = 150
// Asked for once; the browser keeps what it got. Held on to, so that a picture still on
// its way is not dropped.
const preloaded = new Map<string, HTMLImageElement>()

async function preload(cards: readonly CardRef[], cancelled: () => boolean): Promise<void> {
  for (const { cardId, lang } of cards) {
    const card = await tcgdexFor(lang)
      .getCard(cardId)
      .catch(() => undefined)
    if (cancelled()) return
    const url = card && cardImageSources(card, undefined, 'large').own
    if (!url || preloaded.has(url)) continue
    const image = new Image()
    image.src = url
    preloaded.set(url, image)
  }
}

/**
 * Fetches the card pictures of the pages before and after the open ones ahead of time, so
 * that turning a page shows its cards at once instead of one by one.
 */
export function usePreloadedNeighbours(binder: Binder, spreads: readonly Spread[], current: number): void {
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      // forwards first: that is where most page turns go
      const cards = [...cardsOfSpread(binder, spreads[current + 1]), ...cardsOfSpread(binder, spreads[current - 1])]
      void preload(cards, () => cancelled)
    }, SETTLE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `spreads` is rebuilt on every render; it follows from the pages
  }, [binder.pages, current, spreads.length, spreads[0]?.single])
}
