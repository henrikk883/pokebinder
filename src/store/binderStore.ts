import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { binderRepository } from '../db/binderRepository'
import {
  addPage,
  closeGap,
  insertGap,
  duplicatePage,
  insertPage,
  movePage,
  changeLayout,
  clearSlot,
  clearSlots,
  createBinder,
  moveCard,
  moveCards,
  removePage,
  renameBinder,
  setCard,
  setCount,
  setCardLang,
  setOpeningSide,
  setOwned,
  setOwnedMany,
  setVariant,
  sortCards,
  type NewBinderInput,
  type PlacedCard,
} from '../features/binder/binderModel'
import { applyDrop, type DragSource, type DropTarget } from '../features/binder/dragDrop'
import { createCardComparator } from '../features/binder/sorting'
import {
  changePlacement,
  moveImage,
  normalizeImages,
  placeImage,
  removeImage,
  setCover,
  setImageCrop,
  type Placement,
  type PlacementError,
  type PlacementResult,
} from '../features/images/imageModel'
import type {
  Binder,
  BinderCover,
  CardLang,
  ImageCrop,
  CardRef,
  CardVariant,
  Layout,
  OpeningSide,
  SlotPosition,
} from '../types/binder'

/** How many changes of a binder can be taken back. */
export const HISTORY_LIMIT = 100

export type SaveStatus ='idle' | 'saving' | 'saved' | 'error'

export interface BinderState {
  binder: Binder | null
  saveStatus: SaveStatus

  /** Shows a binder that is already stored; does not write. */
  openBinder: (binder: Binder) => void
  closeBinder: () => void
  createBinder: (input: NewBinderInput) => void
  /** Whether there is a change of the open binder to take back, or to bring back. */
  canUndo: boolean
  canRedo: boolean
  /** Takes back the last change of the open binder. */
  undo: () => void
  /** Brings back the change that was last undone; a new change discards what was undone. */
  redo: () => void
  /** Opens a binder that was built elsewhere (e.g. a master set) and stores it. */
  adoptBinder: (binder: Binder) => void
  /** Takes over a reworked version of the open binder, e.g. a rebuilt master set. */
  replaceContent: (binder: Binder) => void
  renameBinder: (name: string) => void
  /** Sorts one page (or, without `pageId`, the whole binder) in the given order. */
  sortCardsBy: (scope: { pageId?: string }, compare: (a: PlacedCard, b: PlacedCard) => number) => void
  setVariant: (position: SlotPosition, variant: CardVariant) => void
  setCardLang: (position: SlotPosition, lang: CardLang) => void
  addPage: () => void
  removePage: (pageId: string) => void
  /** Puts a page where the page with index `toIndex` stands; the pages in between move up. */
  movePage: (pageId: string, toIndex: number) => void
  /** Adds an empty page at `atIndex`. */
  insertPage: (atIndex: number) => void
  /** Adds a copy of a page right behind it. */
  duplicatePage: (pageId: string) => void
  setCard: (position: SlotPosition, cardRef: CardRef, owned?: boolean) => void
  clearSlot: (position: SlotPosition) => void
  moveCard: (from: SlotPosition, to: SlotPosition) => void
  /**
   * Moves several cards together, as when one of them is dragged from `dragged` to
   * `target`. Returns where they now are, or `null` if they do not fit into the binder.
   */
  moveCards: (positions: SlotPosition[], dragged: SlotPosition, target: SlotPosition) => SlotPosition[] | null
  clearSlots: (positions: SlotPosition[]) => void
  setOwnedMany: (positions: SlotPosition[], owned: boolean) => void
  /** Makes room at a pocket: its card and those behind it move one pocket on. */
  insertGap: (position: SlotPosition) => void
  /** Closes the gap at an empty pocket: the cards behind it move one pocket back. */
  closeGap: (position: SlotPosition) => void
  setOwned: (position: SlotPosition, owned: boolean) => void
  /** How many copies of the card in a pocket there are. */
  setCount: (position: SlotPosition, count: number) => void
  setOpeningSide: (pageId: string, openingSide: OpeningSide) => void
  /** Drops a dragged card or library image on a pocket; an image may not fit there. */
  dropCard: (source: DragSource, target: DropTarget) => PlacementError | null
  /** Puts a library image behind the pockets; returns why if that is not possible. */
  placeImage: (pageId: string, assetId: string, placement: Placement) => PlacementError | null
  changePlacement: (pageId: string, imageId: string, placement: Placement) => PlacementError | null
  setImageCrop: (pageId: string, imageId: string, crop: ImageCrop) => void
  removeImage: (pageId: string, imageId: string) => void
  setCover: (cover: BinderCover) => void
  /** Sorts one page (or, without `pageId`, the whole binder) by set and number. */
  sortCards: (scope: { pageId?: string }, setOrder: readonly string[]) => void
  changeLayout: (layout: Layout) => void
  /** Resolves once every change made so far has been written (or failed). */
  whenSaved: () => Promise<void>
}

export interface BinderStoreDeps {
  saveBinder: (binder: Binder) => Promise<void>
}

export function createBinderStore(deps: BinderStoreDeps) {
  return createStore<BinderState>()((set, get) => {
    let saving = false
    let dirty = false
    let pending: Promise<void> = Promise.resolve()

    // One write at a time; changes made meanwhile are written right after.
    async function runSaves(): Promise<void> {
      saving = true
      set({ saveStatus: 'saving' })
      try {
        do {
          dirty = false
          const { binder } = get()
          if (binder) await deps.saveBinder(binder)
        } while (dirty)
        set({ saveStatus: 'saved' })
      } catch {
        set({ saveStatus: 'error' })
      } finally {
        saving = false
      }
    }

    function scheduleSave(): void {
      if (saving) {
        dirty = true
        return
      }
      pending = runSaves()
    }

    // Earlier and undone states of the open binder, oldest first. Binders are never
    // changed in place, so keeping a state means keeping a reference.
    let past: Binder[] = []
    let future: Binder[] = []

    /** Makes `next` the binder, remembering the current one for undo. */
    function commit(current: Binder, next: Binder): void {
      past = [...past, current].slice(-HISTORY_LIMIT)
      future = []
      set({ binder: next, canUndo: true, canRedo: false })
      scheduleSave()
    }

    /** A different binder is on the table: its history starts empty. */
    function forgetHistory(): void {
      past = []
      future = []
    }

    function change(update: (binder: Binder) => Binder): void {
      const { binder } = get()
      if (!binder) return
      const next = update(binder)
      if (next === binder) return
      commit(binder, next)
    }

    /** Like `change`, for updates that can be refused. */
    function attempt(update: (binder: Binder) => PlacementResult): PlacementError | null {
      const { binder } = get()
      if (!binder) return null
      const result = update(binder)
      if (!result.ok) return result.error
      commit(binder, result.binder)
      return null
    }

    return {
      binder: null,
      saveStatus: 'idle',
      canUndo: false,
      canRedo: false,

      openBinder: (binder) => {
        forgetHistory()
        set({ binder, saveStatus: 'saved', canUndo: false, canRedo: false })
      },
      closeBinder: () => {
        forgetHistory()
        set({ binder: null, saveStatus: 'idle', canUndo: false, canRedo: false })
      },
      createBinder: (input) => {
        forgetHistory()
        set({ binder: createBinder(input), canUndo: false, canRedo: false })
        scheduleSave()
      },
      adoptBinder: (binder) => {
        forgetHistory()
        set({ binder, canUndo: false, canRedo: false })
        scheduleSave()
      },
      undo: () => {
        const { binder } = get()
        const previous = past.at(-1)
        if (!binder || !previous) return
        past = past.slice(0, -1)
        future = [...future, binder]
        set({ binder: previous, canUndo: past.length > 0, canRedo: true })
        scheduleSave()
      },
      redo: () => {
        const { binder } = get()
        const next = future.at(-1)
        if (!binder || !next) return
        future = future.slice(0, -1)
        past = [...past, binder]
        set({ binder: next, canUndo: true, canRedo: future.length > 0 })
        scheduleSave()
      },
      replaceContent: (next) =>
        change((binder) => (next.id === binder.id ? normalizeImages(next) : binder)),
      renameBinder: (name) => change((binder) => renameBinder(binder, name)),
      sortCardsBy: (scope, compare) => change((binder) => sortCards(binder, scope, compare)),
      setVariant: (position, variant) => change((binder) => setVariant(binder, position, variant)),
      setCardLang: (position, lang) => change((binder) => setCardLang(binder, position, lang)),
      addPage: () => change((binder) => addPage(binder)),
      // pages behind the removed one change sides, which may cut off images spanning two pages
      removePage: (pageId) => change((binder) => normalizeImages(removePage(binder, pageId))),
      // the same goes for every other change to the order of the pages
      movePage: (pageId, toIndex) => change((binder) => normalizeImages(movePage(binder, pageId, toIndex))),
      insertPage: (atIndex) => change((binder) => normalizeImages(insertPage(binder, atIndex))),
      duplicatePage: (pageId) => change((binder) => normalizeImages(duplicatePage(binder, pageId))),
      setCard: (position, cardRef, owned) =>
        change((binder) => setCard(binder, position, cardRef, owned)),
      clearSlot: (position) => change((binder) => clearSlot(binder, position)),
      moveCard: (from, to) => change((binder) => moveCard(binder, from, to)),
      moveCards: (positions, dragged, target) => {
        const { binder } = get()
        if (!binder) return null
        const result = moveCards(binder, positions, dragged, target)
        if (!result) return null
        if (result.binder !== binder) commit(binder, result.binder)
        return result.moved
      },
      clearSlots: (positions) => change((binder) => clearSlots(binder, positions)),
      setOwnedMany: (positions, owned) => change((binder) => setOwnedMany(binder, positions, owned)),
      insertGap: (position) => change((binder) => insertGap(binder, position)),
      closeGap: (position) => change((binder) => closeGap(binder, position)),
      setOwned: (position, owned) => change((binder) => setOwned(binder, position, owned)),
      setCount: (position, count) => change((binder) => setCount(binder, position, count)),
      setOpeningSide: (pageId, openingSide) =>
        change((binder) => setOpeningSide(binder, pageId, openingSide)),
      dropCard: (source, target) => {
        if (source.kind === 'asset') {
          const { pageId, slotIndex: fromSlot } = target.position
          return get().placeImage(pageId, source.assetId, { fromSlot, spanCols: 1, spanRows: 1 })
        }
        if (source.kind === 'image') {
          return attempt((binder) => moveImage(binder, source.position, target.position))
        }
        change((binder) => applyDrop(binder, source, target))
        return null
      },
      placeImage: (pageId, assetId, placement) =>
        attempt((binder) => placeImage(binder, pageId, assetId, placement)),
      changePlacement: (pageId, imageId, placement) =>
        attempt((binder) => changePlacement(binder, pageId, imageId, placement)),
      setImageCrop: (pageId, imageId, crop) =>
        change((binder) => setImageCrop(binder, pageId, imageId, crop)),
      removeImage: (pageId, imageId) => change((binder) => removeImage(binder, pageId, imageId)),
      setCover: (cover) => change((binder) => setCover(binder, cover)),
      sortCards: (scope, setOrder) =>
        change((binder) => sortCards(binder, scope, createCardComparator(setOrder))),
      changeLayout: (layout) => change((binder) => changeLayout(binder, layout)),
      whenSaved: () => pending,
    }
  })
}

export const binderStore = createBinderStore({ saveBinder: binderRepository.saveBinder })

export function useBinderStore<T>(selector: (state: BinderState) => T): T {
  return useStore(binderStore, selector)
}

/** Reopens the most recently changed binder after a reload, if there is one. */
export async function restoreLastBinder(): Promise<void> {
  const [latest] = await binderRepository.listBinders()
  if (latest && !binderStore.getState().binder) binderStore.getState().openBinder(latest)
}
