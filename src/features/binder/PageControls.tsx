import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
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
  spread: Spread
  spreadCount: number
}

export function PageControls({ spread, spreadCount }: PageControlsProps) {
  const zoom = useEditorStore((state) => state.zoom)
  const setZoom = useEditorStore((state) => state.setZoom)
  const showSpread = useEditorStore((state) => state.showSpread)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" className="flex rounded-control bg-raised p-0.5 text-sm">
        <button type="button" aria-pressed="true" className="h-9 rounded-control bg-accent px-4 font-medium text-white">
          {de.binder.modes.edit}
        </button>
        <button type="button" aria-pressed="false" disabled className="h-9 px-4 text-muted">
          {de.binder.modes.collection}
        </button>
      </div>

      <div className="flex items-center gap-3">
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

      <div role="group" aria-label={de.binder.zoom} className="flex items-center">
        <button
          type="button"
          aria-label={de.binder.zoomOut}
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          className={`${squareClass} rounded-r-none`}
        >
          −
        </button>
        <span data-testid="zoom-value" className="flex h-10 w-16 items-center justify-center border-y border-line bg-raised text-sm">
          {de.binder.zoomValue(zoom)}
        </span>
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
