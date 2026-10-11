import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { binderRepository } from '../db/binderRepository'
import {
  addPage,
  clearSlot,
  createBinder,
  moveCard,
  removePage,
  setCard,
  setOpeningSide,
  setOwned,
  type NewBinderInput,
} from '../features/binder/binderModel'
import type { Binder, CardRef, OpeningSide, SlotPosition } from '../types/binder'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface BinderState {
  binder: Binder | null
  saveStatus: SaveStatus

  /** Shows a binder that is already stored; does not write. */
  openBinder: (binder: Binder) => void
  closeBinder: () => void
  createBinder: (input: NewBinderInput) => void
  addPage: () => void
  removePage: (pageId: string) => void
  setCard: (position: SlotPosition, cardRef: CardRef, owned?: boolean) => void
  clearSlot: (position: SlotPosition) => void
  moveCard: (from: SlotPosition, to: SlotPosition) => void
  setOwned: (position: SlotPosition, owned: boolean) => void
  setOpeningSide: (pageId: string, openingSide: OpeningSide) => void
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

    return {
      binder: null,
      saveStatus: 'idle',

      openBinder: (binder) => set({ binder, saveStatus: 'saved' }),
      closeBinder: () => set({ binder: null, saveStatus: 'idle' }),
      createBinder: (input) => {
        set({ binder: createBinder(input) })
        scheduleSave()
      },
      addPage: () => change((binder) => addPage(binder)),
      removePage: (pageId) => change((binder) => removePage(binder, pageId)),
      setCard: (position, cardRef, owned) =>
        change((binder) => setCard(binder, position, cardRef, owned)),
      clearSlot: (position) => change((binder) => clearSlot(binder, position)),
      moveCard: (from, to) => change((binder) => moveCard(binder, from, to)),
      setOwned: (position, owned) => change((binder) => setOwned(binder, position, owned)),
      setOpeningSide: (pageId, openingSide) =>
        change((binder) => setOpeningSide(binder, pageId, openingSide)),
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
