import type { CardSummary } from '../../lib/tcgdex'
import type { Binder, CardLang, SlotPosition } from '../../types/binder'
import { moveCard, setCard, type ModelContext } from './binderModel'

/** A card being dragged: from the search, or one that already sits in a pocket. */
export type CardDragSource =
  | { kind: 'search'; card: CardSummary; lang: CardLang }
  | { kind: 'pocket'; position: SlotPosition; cardId: string; lang: CardLang }

/** What is being dragged: a card, or an image from the library. */
export type DragSource = CardDragSource | { kind: 'asset'; assetId: string }

export interface DropTarget {
  kind: 'pocket'
  position: SlotPosition
}

export function isDragSource(value: unknown): value is DragSource {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'search' || kind === 'pocket' || kind === 'asset'
}

export function isDropTarget(value: unknown): value is DropTarget {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'pocket'
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
    { cardId: source.card.id, lang: source.lang, variant: 'normal' },
    true,
    ctx,
  )
}
