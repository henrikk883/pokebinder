import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard, type CardSummary } from '../../lib/tcgdex'
import { useAssetUrl } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { CardImage } from '../search/CardImage'
import type { CardLang } from '../../types/binder'
import { useReadyCatalog } from '../search/useCatalog'
import { isDragSource, isDropTarget, type DragSource } from './dragDrop'
import { useCard } from './useCard'

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
  // a few pixels of movement tell a drag from a click on a card
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleStart(event: DragStartEvent) {
    const source: unknown = event.active.data.current
    setDragging(isDragSource(source) ? source : null)
  }

  function handleEnd(event: DragEndEvent) {
    setDragging(null)
    const source: unknown = event.active.data.current
    const target: unknown = event.over?.data.current
    if (!isDragSource(source) || !isDropTarget(target)) return
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
        {dragging?.kind === 'asset' && <AssetPreview assetId={dragging.assetId} />}
      </DragOverlay>
    </DndContext>
  )
}
