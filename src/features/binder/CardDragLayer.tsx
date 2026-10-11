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
import { setIdOfCard, type CardSummary } from '../../lib/tcgdex'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { CardImage } from '../search/CardImage'
import { useCatalog } from '../search/useCatalog'
import { isDragSource, isDropTarget, type DragSource } from './dragDrop'
import { useCard } from './useCard'

function Preview({ card }: { card: CardSummary }) {
  const catalog = useCatalog()
  const set = catalog.status === 'ready' ? catalog.data.setsById.get(setIdOfCard(card)) : undefined
  return (
    <div className="w-28 cursor-grabbing opacity-90 shadow-lg">
      <CardImage card={card} set={set} size="small" />
    </div>
  )
}

function PocketPreview({ cardId }: { cardId: string }) {
  const card = useCard(cardId)
  return card ? <Preview card={card} /> : null
}

/** Makes cards draggable from the search and between pockets, anywhere below it. */
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
    binderStore.getState().dropCard(source, target)
    useEditorStore.getState().select(target.position)
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
        {dragging?.kind === 'search' && <Preview card={dragging.card} />}
        {dragging?.kind === 'pocket' && <PocketPreview cardId={dragging.cardId} />}
      </DragOverlay>
    </DndContext>
  )
}
