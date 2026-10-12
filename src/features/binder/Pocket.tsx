import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { PointerEvent } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { binderStore, useBinderStore } from '../../store/binderStore'
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
import { copiesOf, pocketsBetween } from './binderModel'
import { pocketId, type DragSource, type DropTarget } from './dragDrop'
import { useCard } from './useCard'

const samePocket = (a: SlotPosition, b: SlotPosition) => a.pageId === b.pageId && a.slotIndex === b.slotIndex

interface PocketProps {
  pageId: string
  pageNumber: number
  slot: Slot
  opening: PocketOpening
  /** An uploaded image lies behind this pocket and should stay visible: which one. */
  imageAssetId?: string
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
  /** How many copies of the card there are; more than one is worth a word. */
  copies: number
  selected: boolean
}

function PocketCard({ position, cardRef, owned, copies, selected }: PocketCardProps) {
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
  // foil cards one owns shimmer under the mouse; a missing card has nothing to shine with
  const holo = owned && variant !== 'normal'

  /** Moves the glare to the pointer and tips the card towards it (see `.holo-card` in index.css). */
  function followPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    const { style } = event.currentTarget
    style.setProperty('--holo-x', `${x * 100}%`)
    style.setProperty('--holo-y', `${y * 100}%`)
    style.setProperty('--holo-tilt-x', `${(0.5 - y) * 12}deg`)
    style.setProperty('--holo-tilt-y', `${(x - 0.5) * 12}deg`)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`group relative w-full ${collecting ? 'cursor-pointer' : 'cursor-grab'} ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {copies > 1 && (
        <span
          data-testid="copies-badge"
          // the binder shows one of them; how many there are is no part of its picture
          data-export-hide
          className="pointer-events-none absolute top-1 left-1 z-10 rounded-control bg-bg/90 px-1.5 py-0.5 text-[0.65rem] font-semibold"
        >
          {de.binder.copiesBadge(copies)}
        </span>
      )}
      {showsVariant && (
        <span
          data-testid="variant-badge"
          className="pointer-events-none absolute bottom-1 left-1 z-10 max-w-[90%] truncate rounded-control bg-bg/90 px-1.5 py-0.5 text-[0.6rem] font-medium"
        >
          {de.variantLabel(variant)}
        </span>
      )}
      {card ? (
        <div
          data-holo={holo}
          onPointerMove={holo ? followPointer : undefined}
          className={holo ? 'holo-card relative' : 'relative'}
        >
          <CardImage
            card={card}
            set={catalog?.setsById.get(setIdOfCard(card))}
            size="large"
            missing={!owned}
          />
          {holo && <span aria-hidden="true" data-export-hide className="holo-shine" />}
        </div>
      ) : (
        <div
          // still being looked up: an export of this page waits for it
          data-pending={card === undefined ? '' : undefined}
          className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-[0.65rem] text-muted"
        >
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
        // Under the mouse it shows on the card pointed at. A finger cannot point: there it
        // shows on the card that was tapped, and is large enough to hit.
        className={`absolute top-1 right-1 rounded-control border border-line bg-bg/90 px-1.5 py-0.5 text-[0.65rem] font-medium opacity-0 group-hover:opacity-100 hover:border-accent focus-visible:opacity-100 touch:px-2.5 touch:py-1.5 touch:text-xs ${
          selected ? 'touch:opacity-100' : 'touch:pointer-events-none'
        }`}
      >
        {owned ? de.binder.markMissing : de.binder.markOwned}
      </button>
    </div>
  )
}

export function Pocket({ pageId, pageNumber, slot, opening, imageAssetId }: PocketProps) {
  const overImage = imageAssetId !== undefined
  const position: SlotPosition = { pageId, slotIndex: slot.index }
  const selected = useEditorStore((state) =>
    // of several pockets selected together, each one shows it
    (state.multi.length > 0 ? state.multi : state.selection ? [state.selection] : []).some(
      (other) => other.pageId === pageId && other.slotIndex === slot.index,
    ),
  )
  const select = useEditorStore((state) => state.select)
  const waiting = useEditorStore(
    (state) => state.moving?.pageId === pageId && state.moving.slotIndex === slot.index,
  )
  const clearSlot = useBinderStore((state) => state.clearSlot)
  const setOwned = useBinderStore((state) => state.setOwned)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const card = useCard(slot.cardRef?.cardId, slot.cardRef?.lang ?? DEFAULT_LANG)

  function handleClick(modifiers: { toggle: boolean; range: boolean } = { toggle: false, range: false }) {
    const editor = useEditorStore.getState()
    const binder = binderStore.getState().binder
    // A card waits to be put elsewhere: this pocket is where it goes.
    if (!collecting && editor.moving) {
      const from = editor.moving
      if (editor.multi.length > 1 && editor.multi.some((other) => samePocket(other, from))) {
        const moved = binderStore.getState().moveCards(editor.multi, from, position)
        // without room the cards keep waiting, for another pocket to be tried
        if (!moved) {
          editor.setNotice(de.multi.noRoom)
          return
        }
        editor.cancelMove()
        editor.selectMany(moved)
        return
      }
      editor.cancelMove()
      binderStore.getState().moveCard(from, position)
      select(position)
      return
    }
    // Several pockets are selected with Ctrl (one more or less), with Shift (all from the
    // one selected last to this one), or in the mode that does the first without a key.
    // Not while ticking off the collection, where a click has its own meaning.
    if (!collecting && modifiers.range && editor.selection && binder) {
      const range = pocketsBetween(binder, editor.selection, position)
      // the pocket clicked is the one selected last: the next range starts from it
      const ordered = range[0] && samePocket(range[0], position) ? [...range].reverse() : range
      const kept = editor.multi.filter((other) => !ordered.some((entry) => samePocket(entry, other)))
      editor.selectMany([...kept, ...ordered])
      return
    }
    if (!collecting && (modifiers.toggle || editor.multiMode)) {
      editor.toggleSelect(position)
      return
    }
    select(position)
    // in collection mode a click says "I have this card" or takes it back
    if (collecting && slot.cardRef) setOwned(position, !slot.owned)
  }
  const target: DropTarget = { kind: 'pocket', position }
  const { setNodeRef, isOver } = useDroppable({ id: pocketId(position), data: target })

  const frameClass = selected ? 'ring-2 ring-accent' : isOver ? 'ring-2 ring-accent/60' : 'ring-1 ring-line'
  // Only an own image shows here: it is printed, cut out and put in, so its export carries
  // neither the outline of the pocket nor the mark of its opening.
  const bareImage = overImage && !slot.cardRef
  // The image is moved by dragging it at such a pocket; where a card lies, the card is dragged.
  const imageSource: DragSource | undefined =
    imageAssetId !== undefined ? { kind: 'image', position, assetId: imageAssetId } : undefined
  const imageDrag = useDraggable({
    id: `image:${pocketId(position)}`,
    ...(imageSource ? { data: imageSource } : {}),
    disabled: !bareImage || collecting,
  })
  const movesImage = bareImage && !collecting

  const label = card
    ? de.binder.pocketWithCard(pageNumber, slot.index + 1, card.name)
    : de.binder.pocket(pageNumber, slot.index + 1)

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        imageDrag.setNodeRef(node)
      }}
      {...(movesImage ? imageDrag.listeners : undefined)}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      data-testid="pocket"
      data-card-id={slot.cardRef?.cardId ?? ''}
      data-owned={slot.cardRef ? String(slot.owned) : undefined}
      data-variant={slot.cardRef?.variant}
      data-lang={slot.cardRef?.lang}
      onClick={(event) => handleClick({ toggle: event.ctrlKey || event.metaKey, range: event.shiftKey })}
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
      data-moving={waiting || undefined}
      className={`relative flex aspect-[63/88] items-center justify-center rounded-pocket outline-offset-2 ${
        waiting ? 'outline-2 outline-dashed outline-accent' : ''
      } ${
        overImage ? '' : 'bg-bg/60'
      } ${bareImage ? '' : frameClass} ${movesImage ? 'cursor-grab' : ''}`}
    >
      {/* drawn as a part of its own, so that an export can leave it off the picture */}
      {bareImage && (
        <span
          aria-hidden="true"
          data-export-hide
          className={`pointer-events-none absolute inset-0 rounded-pocket ${frameClass}`}
        />
      )}
      {slot.cardRef ? (
        <PocketCard
          position={position}
          cardRef={slot.cardRef}
          owned={slot.owned}
          copies={copiesOf(slot)}
          selected={selected}
        />
      ) : (
        !overImage && <EmptyPocketIcon />
      )}
      {/* the side where cards slide in */}
      <span
        aria-hidden="true"
        data-testid="pocket-opening"
        data-side={opening}
        data-export-hide={bareImage ? '' : undefined}
        className={`pointer-events-none absolute inset-y-[12%] w-0.5 rounded-full bg-text/50 ${
          opening === 'left' ? 'left-0' : 'right-0'
        }`}
      />
    </div>
  )
}
