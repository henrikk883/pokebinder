import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { de } from '../../i18n/de'
import { baseVariant, setIdOfCard, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import { useAssetUrl } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { CardImage } from '../search/CardImage'
import type { CardLang } from '../../types/binder'
import { useReadyCatalog } from '../search/useCatalog'
import { isDragSource, isDropTarget, withFallback, type DragSource } from './dragDrop'
import { useDragSensors } from './dragSensors'
import { useCard } from './useCard'

/** A dropped card does not wait longer than this for its finish; it then lands as normal. */
const VARIANT_LOOKUP_TIMEOUT_MS = 1500

function Preview({ card, lang }: { card: CardSummary; lang: CardLang }) {
  const set = useReadyCatalog(lang)?.setsById.get(setIdOfCard(card))
  return (
    <div className="w-28 cursor-grabbing opacity-90 shadow-lg">
      <CardImage card={card} set={set} size="small" />
    </div>
  )
}

function PocketPreview({ cardId, lang }: { cardId: string; lang: CardLang }) {
  const card = useCard(cardId, lang)
  return card ? <Preview card={card} lang={lang} /> : null
}

function AssetPreview({ assetId }: { assetId: string }) {
  const url = useAssetUrl(assetId)
  return url ? (
    <img src={url} alt="" className="size-24 cursor-grabbing rounded-pocket object-cover opacity-90 shadow-lg" />
  ) : null
}

/** Makes cards and library images draggable into pockets, anywhere below it. */
export function CardDragLayer({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<DragSource | null>(null)
  const sensors = useDragSensors()

  function handleStart(event: DragStartEvent) {
    const source: unknown = event.active.data.current
    setDragging(isDragSource(source) ? source : null)
    // start looking up the finish while the card is still in the air
    if (isDragSource(source) && source.kind === 'search') {
      tcgdexFor(source.lang)
        .getCardDetail(source.card.id)
        .catch(() => undefined)
    }
  }

  async function handleEnd(event: DragEndEvent) {
    setDragging(null)
    const dragged: unknown = event.active.data.current
    const target: unknown = event.over?.data.current
    if (!isDragSource(dragged) || !isDropTarget(target)) return

    let source = dragged
    if (source.kind === 'search') {
      // A card from the search arrives in the finish it really has: one that only exists
      // as holo is placed as holo. The finishes of its set are usually known already.
      const { card, lang } = source
      const variant = await withFallback(
        tcgdexFor(lang)
          .getCardDetail(card.id)
          .then((detail) => (detail ? baseVariant(detail.variants) : undefined)),
        'normal',
        VARIANT_LOOKUP_TIMEOUT_MS,
      )
      source = { ...source, variant }
    }
    const error = binderStore.getState().dropCard(source, target)
    useEditorStore.getState().select(target.position)
    if (error) useEditorStore.getState().setNotice(de.images.errors[error])
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragging(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging?.kind === 'search' && <Preview card={dragging.card} lang={dragging.lang} />}
        {dragging?.kind === 'pocket' && <PocketPreview cardId={dragging.cardId} lang={dragging.lang} />}
        {(dragging?.kind === 'asset' || dragging?.kind === 'image') && (
          <AssetPreview assetId={dragging.assetId} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
