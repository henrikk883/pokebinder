import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { binderRepository } from '../db/binderRepository'
import {
  addPage,
  changeLayout,
  clearSlot,
  createBinder,
  moveCard,
  removePage,
  setCard,
  setCardLang,
  setOpeningSide,
  setOwned,
  setVariant,
  sortCards,
  type NewBinderInput,
} from '../features/binder/binderModel'
import { applyDrop, type DragSource, type DropTarget } from '../features/binder/dragDrop'
import { createCardComparator } from '../features/binder/sorting'
import {
  changePlacement,
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

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface BinderState {
  binder: Binder | null
  saveStatus: SaveStatus

  /** Shows a binder that is already stored; does not write. */
  openBinder: (binder: Binder) => void
  closeBinder: () => void
  createBinder: (input: NewBinderInput) => void
  /** Opens a binder that was built elsewhere (e.g. a master set) and stores it. */
  adoptBinder: (binder: Binder) => void
  /** Takes over a reworked version of the open binder, e.g. a rebuilt master set. */
  replaceContent: (binder: Binder) => void
  setVariant: (position: SlotPosition, variant: CardVariant) => void
  setCardLang: (position: SlotPosition, lang: CardLang) => void
  addPage: () => void
  removePage: (pageId: string) => void
  setCard: (position: SlotPosition, cardRef: CardRef, owned?: boolean) => void
  clearSlot: (position: SlotPosition) => void
  moveCard: (from: SlotPosition, to: SlotPosition) => void
  setOwned: (position: SlotPosition, owned: boolean) => void
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

    function change(update: (binder: Binder) => Binder): void {
      const { binder } = get()
      if (!binder) return
      const next = update(binder)
      if (next === binder) return
      set({ binder: next })
      scheduleSave()
    }

    /** Like `change`, for updates that can be refused. */
    function attempt(update: (binder: Binder) => PlacementResult): PlacementError | null {
      const { binder } = get()
      if (!binder) return null
      const result = update(binder)
      if (!result.ok) return result.error
      set({ binder: result.binder })
      scheduleSave()
      return null
    }

    return {
      binder: null,
      saveStatus: 'idle',

      openBinder: (binder) => set({ binder, saveStatus: 'saved' }),
      closeBinder: () => set({ binder: null, saveStatus: 'idle' }),
      createBinder: (input) => {
        set({ binder: createBinder(input) })
        scheduleSave()
      },
      adoptBinder: (binder) => {
        set({ binder })
        scheduleSave()
      },
      replaceContent: (next) =>
        change((binder) => (next.id === binder.id ? normalizeImages(next) : binder)),
      setVariant: (position, variant) => change((binder) => setVariant(binder, position, variant)),
      setCardLang: (position, lang) => change((binder) => setCardLang(binder, position, lang)),
      addPage: () => change((binder) => addPage(binder)),
      // pages behind the removed one change sides, which may cut off images spanning two pages
      removePage: (pageId) => change((binder) => normalizeImages(removePage(binder, pageId))),
      setCard: (position, cardRef, owned) =>
        change((binder) => setCard(binder, position, cardRef, owned)),
      clearSlot: (position) => change((binder) => clearSlot(binder, position)),
      moveCard: (from, to) => change((binder) => moveCard(binder, from, to)),
      setOwned: (position, owned) => change((binder) => setOwned(binder, position, owned)),
      setOpeningSide: (pageId, openingSide) =>
        change((binder) => setOpeningSide(binder, pageId, openingSide)),
      dropCard: (source, target) => {
        if (source.kind === 'asset') {
          const { pageId, slotIndex: fromSlot } = target.position
          return get().placeImage(pageId, source.assetId, { fromSlot, spanCols: 1, spanRows: 1 })
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
