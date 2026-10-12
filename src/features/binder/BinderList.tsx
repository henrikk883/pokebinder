import {
  DndContext,
  pointerWithin,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { noteBinderDeleted, requestSync } from '../sync/syncStore'
import { BinderCover } from './BinderCover'
import { countCards, renameBinder } from './binderModel'
import {
  BINDER_SORTS,
  DEFAULT_SHELF_PREFS,
  moveInOrder,
  parseShelfPrefs,
  shiftInOrder,
  sortBinders,
  type BinderSort,
  type ShelfPrefs,
} from './binderOrder'
import { useDragSensors } from './dragSensors'
import { NewBinderDialog } from './NewBinderDialog'

type Listing = { status: 'loading' } | { status: 'ready'; binders: Binder[] } | { status: 'error' }

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

// How the shelf is ordered is a matter of this browser; it is not part of a backup.
const SHELF_PREFS_KEY = 'pokebinder:shelf'

function readShelfPrefs(): ShelfPrefs {
  try {
    return parseShelfPrefs(localStorage.getItem(SHELF_PREFS_KEY))
  } catch {
    return DEFAULT_SHELF_PREFS
  }
}

function storeShelfPrefs(prefs: ShelfPrefs): void {
  try {
    localStorage.setItem(SHELF_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // without storage the order simply lasts until the app is closed
  }
}

interface BinderTileProps {
  binder: Binder
  /** In the collector's own order the binder can be dragged to another place. */
  movable: boolean
  isFirst: boolean
  isLast: boolean
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
  onShift: (steps: number) => void
}

const smallButtonClass =
  'h-8 rounded-control border border-line bg-raised text-xs hover:border-accent disabled:text-muted disabled:hover:border-line'

function BinderTile({ binder, movable, isFirst, isLast, onOpen, onRename, onDelete, onShift }: BinderTileProps) {
  const draggable = useDraggable({ id: binder.id, disabled: !movable })
  const droppable = useDroppable({ id: binder.id, disabled: !movable })
  const { transform, isDragging } = draggable
  const isTarget = droppable.isOver && !isDragging

  return (
    <li
      ref={(node) => {
        draggable.setNodeRef(node)
        droppable.setNodeRef(node)
      }}
      data-testid="binder-tile"
      data-binder-name={binder.name}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`shelf-item flex min-w-0 flex-col rounded-panel ${isDragging ? 'relative z-10 opacity-90' : ''} ${
        isTarget ? 'outline-2 outline-offset-4 outline-accent' : ''
      }`}
    >
      <button
        type="button"
        {...(movable ? draggable.listeners : undefined)}
        aria-label={de.binderList.open(binder.name)}
        onClick={onOpen}
        className={`group block w-full text-left ${movable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <BinderCover binder={binder} />
        <span className="mt-3 block truncate text-base font-medium group-hover:text-accent-hover">
          {binder.name}
        </span>
        <span className="block text-xs text-muted">
          {de.binderList.summary(binder.layout, binder.pages.length, countCards(binder))}
        </span>
        <span className="block text-xs text-muted">{dateFormat.format(new Date(binder.updatedAt))}</span>
      </button>
      <div className="shelf-actions mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-label={de.binderList.renameLabel(binder.name)}
          onClick={onRename}
          className={`${smallButtonClass} min-w-0 truncate px-2`}
        >
          {de.binderList.rename}
        </button>
        <button
          type="button"
          aria-label={de.binderList.deleteLabel(binder.name)}
          onClick={onDelete}
          className="h-8 min-w-0 truncate rounded-control border border-danger/60 px-2 text-xs text-danger hover:bg-danger/10"
        >
          {de.binderList.delete}
        </button>
        {movable && (
          <>
            <button
              type="button"
              aria-label={de.binderList.moveEarlier(binder.name)}
              disabled={isFirst}
              onClick={() => onShift(-1)}
              className={smallButtonClass}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label={de.binderList.moveLater(binder.name)}
              disabled={isLast}
              onClick={() => onShift(1)}
              className={smallButtonClass}
            >
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** "Meine Binder": every stored binder, with the way to a new one. */
export function BinderList() {
  const openBinder = useBinderStore((state) => state.openBinder)
  const adoptBinder = useBinderStore((state) => state.adoptBinder)
  const [listing, setListing] = useState<Listing>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState(0)
  const [prefs, setPrefs] = useState(readShelfPrefs)
  const listVersion = useEditorStore((state) => state.binderListVersion)
  const sensors = useDragSensors()

  useEffect(() => {
    let cancelled = false
    // a binder that was just closed may still be on its way to the database
    const saved = binderStore.getState().whenSaved()
    saved.then(() => binderRepository.listBinders()).then(
      (binders) => {
        if (!cancelled) setListing({ status: 'ready', binders })
      },
      () => {
        if (!cancelled) setListing({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [version, listVersion])

  const binders = listing.status === 'ready' ? sortBinders(listing.binders, prefs.sort, prefs.order) : []
  const custom = prefs.sort === 'custom'

  function changePrefs(next: ShelfPrefs) {
    setPrefs(next)
    storeShelfPrefs(next)
  }

  // the order as shown becomes the stored one, so new binders get their place in it too
  function reorder(change: (ids: string[]) => string[]) {
    changePrefs({ sort: 'custom', order: change(binders.map((binder) => binder.id)) })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return
    reorder((ids) => moveInOrder(ids, String(active.id), String(over.id)))
  }

  async function handleRename(binder: Binder) {
    const name = await promptDialog({
      title: de.binder.rename,
      label: de.newBinder.name,
      value: binder.name,
      confirmLabel: de.binder.renameConfirm,
    })
    if (name === null) return
    await binderRepository.saveBinder(renameBinder(binder, name))
    setVersion((current) => current + 1)
    requestSync()
  }

  async function handleDelete(binder: Binder) {
    const agreed = await confirmDialog({
      title: de.binderList.deleteTitle(binder.name),
      text: de.binderList.confirmDelete,
      confirmLabel: de.binderList.delete,
      danger: true,
    })
    if (!agreed) return
    await binderRepository.deleteBinder(binder.id)
    noteBinderDeleted(binder.id)
    setVersion((current) => current + 1)
    // others that count binders (the backup reminder) should notice too
    useEditorStore.getState().refreshBinderList()
  }

  return (
    <section className="mx-auto flex h-full max-w-5xl flex-col p-5 max-md:p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{de.binderList.title}</h2>
        <div className="flex items-center gap-3">
          <select
            aria-label={de.binderList.sort}
            value={prefs.sort}
            onChange={(event) => {
              const sort = BINDER_SORTS.find((known) => known === event.target.value) ?? prefs.sort
              changePrefs({ ...prefs, sort })
            }}
            className="h-10 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none"
          >
            {BINDER_SORTS.map((sort: BinderSort) => (
              <option key={sort} value={sort}>
                {de.binderList.sorts[sort]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            <span aria-hidden="true">+</span>
            {de.binderList.create}
          </button>
        </div>
      </div>

      {listing.status === 'error' && (
        <p role="alert" className="mt-5 text-sm text-muted">
          {de.binderList.loadFailed}
        </p>
      )}
      {listing.status === 'ready' && binders.length === 0 && (
        <div className="mt-5 flex min-h-64 flex-1 items-center justify-center rounded-panel border border-dashed border-line bg-panel">
          <p className="text-sm text-muted">{de.binderList.empty}</p>
        </div>
      )}
      {custom && binders.length > 1 && <p className="mt-3 text-sm text-muted">{de.binderList.customHint}</p>}
      {binders.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
          {/* a shelf: the binders stand side by side, each showing its cover */}
          <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-5 gap-y-7 max-md:grid-cols-2 max-md:gap-x-3">
            {binders.map((binder, index) => (
              <BinderTile
                key={binder.id}
                binder={binder}
                movable={custom}
                isFirst={index === 0}
                isLast={index === binders.length - 1}
                onOpen={() => openBinder(binder)}
                onRename={() => handleRename(binder)}
                onDelete={() => handleDelete(binder)}
                onShift={(steps) => reorder((ids) => shiftInOrder(ids, binder.id, steps))}
              />
            ))}
          </ul>
        </DndContext>
      )}

      {creating && (
        <NewBinderDialog
          onCancel={() => setCreating(false)}
          onCreate={(binder) => {
            setCreating(false)
            adoptBinder(binder)
          }}
        />
      )}
    </section>
  )
}
