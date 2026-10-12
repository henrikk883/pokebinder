import type { Binder, SlotPosition } from '../../types/binder'

/**
 * Placing cards by tapping them, for screens where search and binder do not fit side by
 * side and nothing can be dragged across: a card goes into the pocket selected in the
 * binder, and the selection moves on to the next free pocket, ready for the next card.
 */

/** A pocket with the numbers the collector knows it by, starting at 1. */
export interface TapTarget {
  position: SlotPosition
  page: number
  pocket: number
}

function describe(binder: Binder, position: SlotPosition): TapTarget | undefined {
  const page = binder.pages.find((entry) => entry.id === position.pageId)
  if (!page || !page.slots[position.slotIndex]) return undefined
  return { position, page: page.index + 1, pocket: position.slotIndex + 1 }
}

/** The first empty pocket from the given place on, in reading order; `undefined` if there is none. */
function firstEmpty(binder: Binder, fromPage: number, fromSlot: number): TapTarget | undefined {
  for (const page of binder.pages) {
    if (page.index < fromPage) continue
    for (const slot of page.slots) {
      if (page.index === fromPage && slot.index < fromSlot) continue
      if (!slot.cardRef) return { position: { pageId: page.id, slotIndex: slot.index }, page: page.index + 1, pocket: slot.index + 1 }
    }
  }
  return undefined
}

/**
 * Where a tapped card goes: into the selected pocket, whatever lies there, since that is
 * what the collector pointed at. Without a selection, into the first empty pocket from
 * the page that lies open. `undefined` if there is no such pocket.
 */
export function tapTarget(
  binder: Binder,
  selection: SlotPosition | null,
  openPageIndex: number,
): TapTarget | undefined {
  const selected = selection ? describe(binder, selection) : undefined
  return selected ?? firstEmpty(binder, Math.max(0, openPageIndex), 0)
}

/** The next empty pocket behind one that was just filled; `undefined` at the end of the binder. */
export function nextEmptyAfter(binder: Binder, position: SlotPosition): TapTarget | undefined {
  const page = binder.pages.find((entry) => entry.id === position.pageId)
  return page ? firstEmpty(binder, page.index, position.slotIndex + 1) : undefined
}
