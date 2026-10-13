import type { CardSummary } from '../../lib/tcgdex'
import type { Binder, CardLang, CardVariant, SlotPosition } from '../../types/binder'
import { moveCard, setCard, type ModelContext } from './binderModel'

/** A card being dragged: from the search, or one that already sits in a pocket. */
export type CardDragSource =
  | {
      kind: 'search'
      card: CardSummary
      lang: CardLang
      /** The finish the card is placed in; looked up when it is dropped, `normal` if unknown. */
      variant?: CardVariant
    }
  | { kind: 'pocket'; position: SlotPosition; cardId: string; lang: CardLang }

/**
 * What is being dragged: a card, an image from the library, or an image that already lies
 * on a page, grabbed at one of the pockets it is behind.
 */
export type DragSource =
  | CardDragSource
  | { kind: 'asset'; assetId: string }
  | { kind: 'image'; position: SlotPosition; assetId: string }
  /** A card that was laid aside, on its way back into a pocket. */
  | { kind: 'tray'; trayId: string; cardId: string; lang: CardLang }

/** The tray beside the binder: a card dropped there is laid aside. */
export interface TrayTarget {
  kind: 'tray'
}

export function isTrayTarget(value: unknown): value is TrayTarget {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'tray'
}

export interface DropTarget {
  kind: 'pocket'
  position: SlotPosition
}

export function isDragSource(value: unknown): value is DragSource {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'search' || kind === 'pocket' || kind === 'asset' || kind === 'image' || kind === 'tray'
}

export function isDropTarget(value: unknown): value is DropTarget {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'pocket'
}

/**
 * Resolves to what `lookup` finds, or to `fallback` if that fails or takes longer than
 * `timeoutMs`: a dropped card should land at once, also without a connection.
 */
export function withFallback<T>(lookup: Promise<T | undefined>, fallback: T, timeoutMs: number): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs)
    lookup.then(
      (value) => {
        clearTimeout(timer)
        resolve(value ?? fallback)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

/** Stable id for dnd-kit. */
export function pocketId(position: SlotPosition): string {
  return `pocket:${position.pageId}:${position.slotIndex}`
}

/**
 * Result of dropping a card on a pocket. A card from the search replaces what is there;
 * a card from another pocket moves, and swaps places with a card in the target.
 */
export function applyDrop(
  binder: Binder,
  source: CardDragSource,
  target: DropTarget,
  ctx?: ModelContext,
): Binder {
  if (source.kind === 'pocket') return moveCard(binder, source.position, target.position, ctx)
  return setCard(
    binder,
    target.position,
    { cardId: source.card.id, lang: source.lang, variant: source.variant ?? 'normal' },
    true,
    ctx,
  )
}
