import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { BinderFind } from './BinderFind'
import { trayOf } from './binderModel'
import { MAX_ZOOM, MIN_ZOOM, pageNumbersOf, ZOOM_STEP, type Spread } from './spreads'

const squareClass =
  'flex size-10 items-center justify-center rounded-control border border-line bg-raised hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <path
        d={direction === 'left' ? 'm12 5-5 5 5 5' : 'm8 5 5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

interface PageControlsProps {
  binder: Binder
  spread: Spread
  spreadCount: number
}

export function PageControls({ binder, spread, spreadCount }: PageControlsProps) {
  const zoom = useEditorStore((state) => state.zoom)
  const setZoom = useEditorStore((state) => state.setZoom)
  const autoZoom = useEditorStore((state) => state.autoZoom)
  const autoFit = useEditorStore((state) => state.autoFit)
  const showSpread = useEditorStore((state) => state.showSpread)
  const mode = useEditorStore((state) => state.mode)
  const setMode = useEditorStore((state) => state.setMode)
  const showTray = useEditorStore((state) => state.showTray)
  const openTray = useEditorStore((state) => state.openTray)
  const laidAside = trayOf(binder).length
  const multiMode = useEditorStore((state) => state.multiMode)
  const setMultiMode = useEditorStore((state) => state.setMultiMode)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label={de.binder.mode} className="flex rounded-control bg-raised p-0.5 text-sm">
        {(['edit', 'collection'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option && !showTray}
            title={option === 'collection' ? de.binder.collectionHint : undefined}
            onClick={() => setMode(option)}
            className={`h-9 rounded-control px-4 font-medium ${
              mode === option && !showTray ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            {de.binder.modes[option]}
          </button>
        ))}
        {/* the cards laid aside while rearranging; their number shows whatever the mode */}
        <button
          type="button"
          aria-pressed={showTray}
          title={de.tray.buttonHint}
          onClick={openTray}
          className={`h-9 rounded-control px-4 font-medium ${showTray ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
        >
          {de.tray.button(laidAside)}
        </button>
      </div>
      {mode === 'edit' && (
        <button
          type="button"
          aria-pressed={multiMode}
          title={de.multi.toggleHint}
          onClick={() => setMultiMode(!multiMode)}
          className={`h-10 rounded-control border px-3 text-sm ${
            multiMode ? 'border-accent bg-accent text-white' : 'border-line bg-raised hover:border-accent'
          }`}
        >
          {de.multi.toggle}
        </button>
      )}

      <div className="flex items-center gap-3">
        {/* beside the arrows: both are ways to another page */}
        <BinderFind binder={binder} buttonClass={squareClass} />
        <button
          type="button"
          aria-label={de.binder.previous}
          disabled={spread.index === 0}
          onClick={() => showSpread(spread.index - 1)}
          className={squareClass}
        >
          <Chevron direction="left" />
        </button>
        <span data-testid="spread-label" className="min-w-28 text-center text-sm">
          {de.binder.spreadLabel(pageNumbersOf(spread))}
        </span>
        <button
          type="button"
          aria-label={de.binder.next}
          disabled={spread.index >= spreadCount - 1}
          onClick={() => showSpread(spread.index + 1)}
          className={squareClass}
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div role="group" aria-label={de.binder.zoom} className="flex items-center max-md:hidden">
        <button
          type="button"
          aria-label={de.binder.zoomOut}
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          className={`${squareClass} rounded-r-none`}
        >
          −
        </button>
        <button
          type="button"
          data-testid="zoom-value"
          data-auto={autoZoom}
          // a zoom that was picked stays; this is the way back to the one that fits
          title={autoZoom ? de.binder.zoomIsAuto : de.binder.zoomAuto}
          aria-label={autoZoom ? de.binder.zoomIsAuto : de.binder.zoomAuto}
          disabled={autoZoom}
          onClick={autoFit}
          className="flex h-10 w-16 items-center justify-center border-y border-line bg-raised text-sm enabled:hover:border-accent"
        >
          {de.binder.zoomValue(zoom)}
        </button>
        <button
          type="button"
          aria-label={de.binder.zoomIn}
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom(zoom + ZOOM_STEP)}
          className={`${squareClass} rounded-l-none`}
        >
          +
        </button>
      </div>
    </div>
  )
}
