import { create } from 'zustand'
import { clampZoom, DEFAULT_ZOOM } from '../features/binder/spreads'
import { DEFAULT_LANG, type CardLang, type SlotPosition } from '../types/binder'

export type EditorMode = 'edit' | 'collection'
/** What fills the app: the binders (shelf or open binder), or the page to browse cards. */
export type AppView = 'binders' | 'cards'

/** View state of the binder editor; nothing here is saved. */
export interface EditorState {
  view: AppView
  showView: (view: AppView) => void
  /** Which spread lies open. Components clamp it to the spreads that exist. */
  spreadIndex: number
  zoom: number
  /**
   * The zoom follows the room the binder has, until the collector picks one with the
   * buttons; opening another binder hands it back.
   */
  autoZoom: boolean
  selection: SlotPosition | null
  /** `edit` arranges the binder; in `collection` a click on a card toggles owned / missing. */
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  /**
   * In `collection` the search is folded away, since nothing is dragged then. This says
   * the collector brought it back for the time being; changing the mode forgets it.
   */
  searchShownWhileCollecting: boolean
  showSearchWhileCollecting: (shown: boolean) => void
  /** Counts up when binders were added from outside (a backup), so that lists read them again. */
  binderListVersion: number
  refreshBinderList: () => void
  /** Language of the card search; a binder that is opened sets it to its own language. */
  searchLang: CardLang
  setSearchLang: (lang: CardLang) => void
  /** Message about the last action that did not work, e.g. an image that does not fit. */
  notice: string | null

  setNotice: (notice: string | null) => void
  showSpread: (index: number) => void
  /** The collector picks a zoom; it then stays. */
  setZoom: (zoom: number) => void
  /** The app adapts the zoom to the room there is. */
  fitZoomTo: (zoom: number) => void
  select: (position: SlotPosition | null) => void
  /**
   * The pockets selected together, when there is more than one; empty otherwise. The one
   * selected last is also `selection`.
   */
  multi: SlotPosition[]
  /** Every click on a pocket adds it to the selection or takes it out: the way to select several by finger. */
  multiMode: boolean
  setMultiMode: (on: boolean) => void
  /** Adds a pocket to the selection, or takes it out if it is in it. */
  toggleSelect: (position: SlotPosition) => void
  /** Selects exactly these pockets; the last one becomes the one the details are shown of. */
  selectMany: (positions: SlotPosition[]) => void
  /** Back to the first spread, e.g. when another binder is opened. */
  reset: (searchLang?: CardLang) => void
}

/** One pocket is a plain selection; only two or more are a selection of several. */
function selectionOf(positions: SlotPosition[]): Pick<EditorState, 'selection' | 'multi' | 'notice'> {
  return {
    selection: positions[positions.length - 1] ?? null,
    multi: positions.length > 1 ? positions : [],
    notice: null,
  }
}

export const useEditorStore = create<EditorState>()((set) => ({
  view: 'binders',
  showView: (view) => set({ view }),
  spreadIndex: 0,
  zoom: DEFAULT_ZOOM,
  autoZoom: true,
  selection: null,
  mode: 'edit',
  notice: null,

  setMode: (mode) =>
    set({ mode, notice: null, searchShownWhileCollecting: false, multi: [], multiMode: false }),
  multi: [],
  multiMode: false,
  // leaving the mode keeps what is selected, so that it can be acted on
  setMultiMode: (multiMode) => set({ multiMode }),
  toggleSelect: (position) =>
    set((state) => {
      const same = (other: SlotPosition) => other.pageId === position.pageId && other.slotIndex === position.slotIndex
      // a single selection is where a selection of several starts from
      const current = state.multi.length > 0 ? state.multi : state.selection ? [state.selection] : []
      const next = current.some(same) ? current.filter((other) => !same(other)) : [...current, position]
      return selectionOf(next)
    }),
  selectMany: (positions) => set(selectionOf(positions)),
  searchShownWhileCollecting: false,
  showSearchWhileCollecting: (searchShownWhileCollecting) => set({ searchShownWhileCollecting }),
  binderListVersion: 0,
  refreshBinderList: () => set((state) => ({ binderListVersion: state.binderListVersion + 1 })),
  searchLang: DEFAULT_LANG,
  setSearchLang: (searchLang) => set({ searchLang }),
  setNotice: (notice) => set({ notice }),
  showSpread: (index) => set({ spreadIndex: Math.max(0, index), selection: null, multi: [], notice: null }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom), autoZoom: false }),
  fitZoomTo: (zoom) => set({ zoom: clampZoom(zoom) }),
  select: (selection) => set({ selection, multi: [], notice: null }),
  reset: (searchLang) =>
    set((state) => ({
      // a binder that is opened is what the collector wants to see
      view: 'binders',
      spreadIndex: 0,
      zoom: DEFAULT_ZOOM,
      autoZoom: true,
      selection: null,
      multi: [],
      multiMode: false,
      notice: null,
      mode: 'edit',
      searchShownWhileCollecting: false,
      searchLang: searchLang ?? state.searchLang,
    })),
}))
