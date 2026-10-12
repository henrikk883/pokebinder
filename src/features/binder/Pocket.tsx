import { useDraggable, useDroppable } from '@dnd-kit/core'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import {
  DEFAULT_LANG,
  type CardRef,
  type PocketOpening,
  type Slot,
  type SlotPosition,
} from '../../types/binder'
import { CardImage } from '../search/CardImage'
import { useReadyCatalog } from '../search/useCatalog'
import { pocketId, type DragSource, type DropTarget } from './dragDrop'
import { useCard } from './useCard'

interface PocketProps {
  pageId: string
  pageNumber: number
  slot: Slot
  opening: PocketOpening
  /** An uploaded image lies behind this pocket and should stay visible. */
  overImage: boolean
}

function EmptyPocketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-1/3 text-line" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h6m6 0h6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

interface PocketCardProps {
  position: SlotPosition
  cardRef: CardRef
  owned: boolean
}

function PocketCard({ position, cardRef, owned }: PocketCardProps) {
  const { cardId, variant, lang } = cardRef
  const card = useCard(cardId, lang)
  const catalog = useReadyCatalog(lang)
  const setOwned = useBinderStore((state) => state.setOwned)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const source: DragSource = { kind: 'pocket', position, cardId, lang }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `card:${pocketId(position)}`,
    data: source,
    disabled: collecting,
  })
  // normal and holo are what the picture shows anyway; the other finishes need a word
  const showsVariant = variant !== 'normal' && variant !== 'holo'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`group relative w-full ${collecting ? 'cursor-pointer' : 'cursor-grab'} ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {showsVariant && (
        <span
          data-testid="variant-badge"
          className="pointer-events-none absolute bottom-1 left-1 z-10 max-w-[90%] truncate rounded-control bg-bg/90 px-1.5 py-0.5 text-[0.6rem] font-medium"
        >
          {de.variantLabel(variant)}
        </span>
      )}
      {card ? (
        <CardImage
          card={card}
          set={catalog?.setsById.get(setIdOfCard(card))}
          size="large"
          missing={!owned}
        />
      ) : (
        <div className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-[0.65rem] text-muted">
          {card === null ? de.binder.unknownCard : ''}
        </div>
      )}
      <button
        type="button"
        aria-label={owned ? de.binder.markMissingLabel : de.binder.markOwnedLabel}
        aria-pressed={!owned}
        data-export-hide
        onClick={(event) => {
          event.stopPropagation()
          setOwned(position, !owned)
        }}
        className="absolute top-1 right-1 rounded-control border border-line bg-bg/90 px-1.5 py-0.5 text-[0.65rem] font-medium opacity-0 group-hover:opacity-100 hover:border-accent focus-visible:opacity-100"
      >
        {owned ? de.binder.markMissing : de.binder.markOwned}
      </button>
    </div>
  )
}

export function Pocket({ pageId, pageNumber, slot, opening, overImage }: PocketProps) {
  const position: SlotPosition = { pageId, slotIndex: slot.index }
  const selected = useEditorStore(
    (state) => state.selection?.pageId === pageId && state.selection.slotIndex === slot.index,
  )
  const select = useEditorStore((state) => state.select)
  const clearSlot = useBinderStore((state) => state.clearSlot)
  const setOwned = useBinderStore((state) => state.setOwned)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const card = useCard(slot.cardRef?.cardId, slot.cardRef?.lang ?? DEFAULT_LANG)

  function handleClick() {
    select(position)
    // in collection mode a click says "I have this card" or takes it back
    if (collecting && slot.cardRef) setOwned(position, !slot.owned)
  }
  const target: DropTarget = { kind: 'pocket', position }
  const { setNodeRef, isOver } = useDroppable({ id: pocketId(position), data: target })

  const label = card
    ? de.binder.pocketWithCard(pageNumber, slot.index + 1, card.name)
    : de.binder.pocket(pageNumber, slot.index + 1)

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      data-testid="pocket"
      data-card-id={slot.cardRef?.cardId ?? ''}
      data-owned={slot.cardRef ? String(slot.owned) : undefined}
      data-variant={slot.cardRef?.variant}
      data-lang={slot.cardRef?.lang}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (slot.cardRef && !collecting) clearSlot(position)
      }}
      data-over-image={overImage}
      className={`relative flex aspect-[63/88] items-center justify-center rounded-pocket outline-offset-2 ${
        overImage ? '' : 'bg-bg/60'
      } ${selected ? 'ring-2 ring-accent' : isOver ? 'ring-2 ring-accent/60' : 'ring-1 ring-line'}`}
    >
      {slot.cardRef ? (
        <PocketCard
          position={position}
          cardRef={slot.cardRef}
          owned={slot.owned}
        />
      ) : (
        !overImage && <EmptyPocketIcon />
      )}
      {/* the side where cards slide in */}
      <span
        aria-hidden="true"
        data-testid="pocket-opening"
        data-side={opening}
        className={`pointer-events-none absolute inset-y-[12%] w-0.5 rounded-full bg-text/50 ${
          opening === 'left' ? 'left-0' : 'right-0'
        }`}
      />
    </div>
  )
}
