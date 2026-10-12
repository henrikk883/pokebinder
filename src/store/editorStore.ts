import { create } from 'zustand'
import { clampZoom, DEFAULT_ZOOM } from '../features/binder/spreads'
import { DEFAULT_LANG, type CardLang, type SlotPosition } from '../types/binder'

export type EditorMode = 'edit' | 'collection'

/** View state of the binder editor; nothing here is saved. */
export interface EditorState {
  /** Which spread lies open. Components clamp it to the spreads that exist. */
  spreadIndex: number
  zoom: number
  selection: SlotPosition | null
  /** `edit` arranges the binder; in `collection` a click on a card toggles owned / missing. */
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  /** Language of the card search; a binder that is opened sets it to its own language. */
  searchLang: CardLang
  setSearchLang: (lang: CardLang) => void
  /** Message about the last action that did not work, e.g. an image that does not fit. */
  notice: string | null

  setNotice: (notice: string | null) => void
  showSpread: (index: number) => void
  setZoom: (zoom: number) => void
  select: (position: SlotPosition | null) => void
  /** Back to the first spread, e.g. when another binder is opened. */
  reset: (searchLang?: CardLang) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  spreadIndex: 0,
  zoom: DEFAULT_ZOOM,
  selection: null,
  mode: 'edit',
  notice: null,

  setMode: (mode) => set({ mode, notice: null }),
  searchLang: DEFAULT_LANG,
  setSearchLang: (searchLang) => set({ searchLang }),
  setNotice: (notice) => set({ notice }),
  showSpread: (index) => set({ spreadIndex: Math.max(0, index), selection: null, notice: null }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  select: (selection) => set({ selection, notice: null }),
  reset: (searchLang) =>
    set((state) => ({
      spreadIndex: 0,
      selection: null,
      notice: null,
      mode: 'edit',
      searchLang: searchLang ?? state.searchLang,
    })),
}))
