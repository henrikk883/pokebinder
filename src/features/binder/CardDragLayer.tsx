import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import { useAssetUrl } from '../../store/assetStore'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { CardImage } from '../search/CardImage'
import type { CardLang } from '../../types/binder'
import { useReadyCatalog } from '../search/useCatalog'
import { isDragSource, isDropTarget, isTrayTarget, type DragSource } from './dragDrop'
import { baseVariantOf } from './placeCard'
import { useDragSensors } from './dragSensors'
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
    if (!isDragSource(dragged)) return
    const editor = useEditorStore.getState()
    if (isTrayTarget(target)) {
      // a card dropped on the tray is laid aside; one of several selected takes the others along
      if (dragged.kind !== 'pocket') return
      const { position } = dragged
      const together = editor.multi.some((other) => other.pageId === position.pageId && other.slotIndex === position.slotIndex)
      binderStore.getState().toTray(together ? editor.multi : [position])
      editor.select(null)
      return
    }
    if (!isDropTarget(target)) return

    let source = dragged
    const grabbed = source.kind === 'pocket' ? source.position : undefined
    if (
      grabbed &&
      editor.multi.some((other) => other.pageId === grabbed.pageId && other.slotIndex === grabbed.slotIndex)
    ) {
      const moved = binderStore.getState().moveCards(editor.multi, grabbed, target.position)
      // the cards stay selected where they now lie, ready for the next step
      if (moved) editor.selectMany(moved)
      else editor.setNotice(de.multi.noRoom)
      return
    }
    if (source.kind === 'search') {
      // A card from the search arrives in the finish it really has: one that only exists
      // as holo is placed as holo. The finishes of its set are usually known already.
      const { card, lang } = source
      source = { ...source, variant: await baseVariantOf(card.id, lang) }
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
        {(dragging?.kind === 'pocket' || dragging?.kind === 'tray') && (
          <PocketPreview cardId={dragging.cardId} lang={dragging.lang} />
        )}
        {(dragging?.kind === 'asset' || dragging?.kind === 'image') && (
          <AssetPreview assetId={dragging.assetId} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
