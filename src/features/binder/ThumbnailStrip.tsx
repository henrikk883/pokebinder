import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder, Page } from '../../types/binder'
import { layoutDimensions } from './binderModel'
import { isPhone } from '../../lib/phone'
import { useDragSensors } from './dragSensors'
import { pageNumbersOf, spreadOfPage, type Spread } from './spreads'

function MiniPockets({ binder, page }: { binder: Binder; page: Page }) {
  const { cols } = layoutDimensions(binder.layout)
  return (
    <span className="grid size-full gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {page.slots.map((slot) => (
        <span key={slot.index} className={`rounded-[1px] ${slot.cardRef ? 'bg-muted' : 'bg-line'}`} />
      ))}
    </span>
  )
}

interface MiniPageProps {
  binder: Binder
  page: Page
  /** Pages are put in another order by dragging them onto each other. */
  movable: boolean
}

function MiniPage({ binder, page, movable }: MiniPageProps) {
  const draggable = useDraggable({ id: page.id, disabled: !movable })
  const droppable = useDroppable({ id: page.id, disabled: !movable })
  const isTarget = droppable.isOver && !draggable.isDragging

  return (
    <span
      ref={(node) => {
        draggable.setNodeRef(node)
        droppable.setNodeRef(node)
      }}
      {...(movable ? draggable.listeners : undefined)}
      data-testid="mini-page"
      data-page-number={page.index + 1}
      className={`block h-full flex-1 rounded-[2px] ${movable ? 'cursor-grab' : ''} ${
        draggable.isDragging ? 'opacity-30' : ''
      } ${isTarget ? 'outline-2 outline-offset-1 outline-accent' : ''}`}
    >
      <MiniPockets binder={binder} page={page} />
    </span>
  )
}

function MiniSide({ binder, content, movable }: { binder: Binder; content: Spread['left']; movable: boolean }) {
  const page = typeof content === 'number' ? binder.pages[content] : undefined
  if (!page) {
    return <span className={`block h-full flex-1 rounded-sm ${content === 'cover' ? 'bg-line' : ''}`} />
  }
  return <MiniPage binder={binder} page={page} movable={movable} />
}

interface ThumbnailStripProps {
  binder: Binder
  spreads: Spread[]
  current: number
}

/**
 * All spreads in miniature, for jumping straight to one. A page dragged onto another one
 * takes its place; the pages in between move up.
 */
export function ThumbnailStrip({ binder, spreads, current }: ThumbnailStripProps) {
  const showSpread = useEditorStore((state) => state.showSpread)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const movePage = useBinderStore((state) => state.movePage)
  const currentThumbnail = useRef<HTMLButtonElement>(null)
  const sensors = useDragSensors()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const dragged = draggedId === null ? undefined : binder.pages.find((page) => page.id === draggedId)
  // while cards are ticked off nothing is rearranged, and one page has nowhere to go
  const movable = !collecting && binder.pages.length > 1

  // a master set has dozens of spreads; keep the open one in view
  useEffect(() => {
    currentThumbnail.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [current, spreads.length])

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedId(null)
    const target = over ? binder.pages.find((page) => page.id === over.id) : undefined
    if (!target || target.id === active.id) return
    movePage(String(active.id), target.index)
    // follow the page to where it now lies
    showSpread(spreadOfPage(target.index, isPhone()))
  }

  return (
    <nav aria-label={de.binder.thumbnails} className="shrink-0 overflow-x-auto py-1">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => setDraggedId(String(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedId(null)}
      >
        {/* centred while it fits, scrollable from the first thumbnail when it does not */}
        <div className="mx-auto flex w-max gap-3">
          {spreads.map((spread) => {
            const label = de.binder.thumbnailLabel(pageNumbersOf(spread))
            const active = spread.index === current
            return (
              <button
                key={spread.index}
                ref={active ? currentThumbnail : undefined}
                type="button"
                aria-label={de.binder.spreadLabel(pageNumbersOf(spread))}
                aria-current={active ? 'page' : undefined}
                onClick={() => showSpread(spread.index)}
                className="flex shrink-0 flex-col items-center gap-1"
              >
                <span
                  className={`flex h-14 gap-1 rounded-control border-2 bg-panel p-1 ${spread.single ? 'w-11' : 'w-22'} ${
                    active ? 'border-accent' : 'border-line hover:border-muted'
                  }`}
                >
                  {!spread.single && <MiniSide binder={binder} content={spread.left} movable={movable} />}
                  <MiniSide binder={binder} content={spread.right} movable={movable} />
                </span>
                <span className={`text-xs ${active ? 'text-accent-hover' : 'text-muted'}`}>{label}</span>
              </button>
            )
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && (
            <span className="block h-12 w-9 cursor-grabbing rounded-[2px] bg-panel p-0.5 opacity-90 shadow-lg">
              <MiniPockets binder={binder} page={dragged} />
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </nav>
  )
}
