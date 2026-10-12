import { create } from 'zustand'
import { clampZoom, DEFAULT_ZOOM } from '../features/binder/spreads'
import type { SlotPosition } from '../types/binder'

/** View state of the binder editor; nothing here is saved. */
export interface EditorState {
  /** Which spread lies open. Components clamp it to the spreads that exist. */
  spreadIndex: number
  zoom: number
  selection: SlotPosition | null
  /** Message about the last action that did not work, e.g. an image that does not fit. */
  notice: string | null

  setNotice: (notice: string | null) => void
  showSpread: (index: number) => void
  setZoom: (zoom: number) => void
  select: (position: SlotPosition | null) => void
  /** Back to the first spread, e.g. when another binder is opened. */
  reset: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  spreadIndex: 0,
  zoom: DEFAULT_ZOOM,
  selection: null,
  notice: null,

  setNotice: (notice) => set({ notice }),
  showSpread: (index) => set({ spreadIndex: Math.max(0, index), selection: null, notice: null }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  select: (selection) => set({ selection, notice: null }),
  reset: () => set({ spreadIndex: 0, selection: null, notice: null }),
}))
