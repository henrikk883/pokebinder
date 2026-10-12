import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { de } from '../../i18n/de'
import { useIsPhone } from '../../lib/phone'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { BinderSpread } from './BinderSpread'
import { BinderToolbar } from './BinderToolbar'
import { PageControls } from './PageControls'
import { ProgressBar } from './ProgressBar'
import { buildSpreads, clampSpread, fitZoom } from './spreads'
import { ThumbnailStrip } from './ThumbnailStrip'

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select') !== null
}

/** Arrow keys turn the pages, Delete empties the selected pocket, Ctrl+Z / Ctrl+Y undo and redo. */
function useEditorKeys(spreadCount: number) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.altKey) return
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+Z takes back, Ctrl+Y or Ctrl+Shift+Z brings back
        const key = event.key.toLowerCase()
        if (key !== 'z' && key !== 'y') return
        event.preventDefault()
        if (key === 'z' && !event.shiftKey) binderStore.getState().undo()
        else binderStore.getState().redo()
        return
      }
      const editor = useEditorStore.getState()
      const current = clampSpread(editor.spreadIndex, spreadCount)
      if (event.key === 'ArrowLeft') editor.showSpread(clampSpread(current - 1, spreadCount))
      else if (event.key === 'ArrowRight') editor.showSpread(clampSpread(current + 1, spreadCount))
      else if (event.key === 'Escape' && editor.moving) {
        editor.cancelMove()
      } else if (event.key === 'Delete' && editor.multi.length > 1) {
        binderStore.getState().clearSlots(editor.multi)
      } else if (event.key === 'Delete' && editor.selection) {
        binderStore.getState().clearSlot(editor.selection)
      } else if (event.key === 'Escape' && editor.multi.length > 1) {
        editor.select(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [spreadCount])
}

/**
 * Keeps the open binder as large as fits into its frame (see `fitZoom`), until the
 * collector picks a zoom. `frame` is the scrolling area, the binder its only child.
 *
 * The zoom is fitted when a binder is opened and when the room changes for good: a column
 * folded away, the window resized, the tablet turned. Not when a notice appears above the
 * binder for a moment; the binder must not jump because of that.
 */
function useAutoZoom(
  frame: RefObject<HTMLDivElement | null>,
  zoom: number,
  layoutKey: string,
  /** On a phone the page fills the width and the screen scrolls; its height is no limit. */
  widthOnly: boolean,
) {
  const autoZoom = useEditorStore((state) => state.autoZoom)

  useLayoutEffect(() => {
    const element = frame.current
    if (!autoZoom || !element) return

    function fit() {
      const spread = element?.firstElementChild
      if (!element || !(spread instanceof HTMLElement)) return
      const next = fitZoom(
        zoom,
        { width: spread.offsetWidth, height: spread.offsetHeight },
        { width: element.clientWidth, height: widthOnly ? Number.MAX_SAFE_INTEGER : element.clientHeight },
      )
      if (next !== zoom) useEditorStore.getState().fitZoomTo(next)
    }
    // each step towards the fitting zoom brings the effect back here for the next one
    fit()

    // later changes are answered a frame later: setting the zoom changes the layout again
    let request = 0
    const fitSoon = () => {
      cancelAnimationFrame(request)
      request = requestAnimationFrame(fit)
    }
    window.addEventListener('resize', fitSoon)
    let width = element.clientWidth
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            if (element.clientWidth === width) return
            width = element.clientWidth
            fitSoon()
          })
    observer?.observe(element)
    return () => {
      cancelAnimationFrame(request)
      window.removeEventListener('resize', fitSoon)
      observer?.disconnect()
    }
  }, [frame, autoZoom, zoom, layoutKey, widthOnly])
}

export function BinderEditor({ binder }: { binder: Binder }) {
  const zoom = useEditorStore((state) => state.zoom)
  const spreadIndex = useEditorStore((state) => state.spreadIndex)
  const notice = useEditorStore((state) => state.notice)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const moving = useEditorStore((state) => state.moving)
  const selection = useEditorStore((state) => state.selection)
  const several = useEditorStore((state) => state.multi.length > 1)
  const startMove = useEditorStore((state) => state.startMove)
  const cancelMove = useEditorStore((state) => state.cancelMove)
  const selectedHasCard =
    selection !== null &&
    binder.pages.find((page) => page.id === selection.pageId)?.slots[selection.slotIndex]?.cardRef !== undefined

  const phone = useIsPhone()
  const spreads = buildSpreads(binder.pages.length, phone)
  const current = clampSpread(spreadIndex, spreads.length)
  const spread = spreads[current]
  useEditorKeys(spreads.length)
  const frame = useRef<HTMLDivElement>(null)
  // the line that explains "Sammlung" takes room for as long as the mode lasts
  useAutoZoom(frame, zoom, `${binder.id}:${binder.layout}:${collecting}:${phone}`, phone)

  if (!spread) return null

  return (
    <section className="flex h-full flex-col gap-4 p-5 max-md:h-auto max-md:gap-3 max-md:p-3">
      <BinderToolbar binder={binder} spread={spread} />
      <PageControls spread={spread} spreadCount={spreads.length} />
      {collecting && (
        <p data-testid="collection-hint" className="text-sm text-muted">
          {de.binder.collectionHint}
        </p>
      )}
      {moving && (
        <p
          role="status"
          data-testid="move-hint"
          className="flex items-center justify-between gap-3 rounded-control border border-accent bg-raised px-3 py-2 text-sm"
        >
          <span>{several ? de.move.hintMany : de.move.hint}</span>
          <button
            type="button"
            onClick={cancelMove}
            className="h-8 shrink-0 rounded-control border border-line bg-panel px-3 text-xs hover:border-accent"
          >
            {de.move.cancel}
          </button>
        </p>
      )}
      {/* on a phone the selection column is a tap away; the way to move a card is right here */}
      {!moving && !collecting && selection && selectedHasCard && (
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => startMove(selection)}
            className="h-9 rounded-control border border-line bg-raised px-3 text-sm hover:border-accent"
          >
            {de.move.start}
          </button>
        </div>
      )}
      {notice && (
        <p role="alert" className="rounded-control border border-line bg-raised px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <div
        ref={frame}
        data-testid="binder-frame"
        className="min-h-0 flex-1 overflow-auto max-md:flex-none max-md:overflow-visible"
      >
        <BinderSpread binder={binder} spread={spread} zoom={zoom} />
      </div>
      <ThumbnailStrip binder={binder} spreads={spreads} current={current} />
      <ProgressBar binder={binder} />
    </section>
  )
}
