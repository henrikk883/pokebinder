import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { de } from '../i18n/de'
import { useBinderStore } from '../store/binderStore'
import { useIsPhone } from '../lib/phone'
import { APP_PANES, useEditorStore, type AppPane } from '../store/editorStore'
import { clampColumnWidth, DEFAULT_COLUMN_WIDTH, readColumnWidths, storeColumnWidths, type ColumnWidths } from './columnWidths'

interface AppLayoutProps {
  header: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  footer: ReactNode
  /**
   * A page of its own that takes the place of the three columns, e.g. "Karten". The
   * columns stay as they are underneath, so the binder and its search are found again
   * as they were left.
   */
  page?: ReactNode
}

interface OpenColumns {
  left: boolean
  right: boolean
}

// Which columns are folded away is a matter of this device; it is not part of a backup.
const COLUMNS_KEY = 'pokebinder:columns'
/** From this width on (Tailwind's `xl`) there is room for all three columns side by side. */
const WIDE_SCREEN = '(min-width: 80rem)'

/** The columns as they were left last time; at first all that fit: on a narrow screen without the right one. */
function readOpenColumns(): OpenColumns {
  const wide = typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_SCREEN).matches
  const columns: OpenColumns = { left: true, right: wide }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? 'null')
    if (typeof stored === 'object' && stored !== null) {
      const { left, right } = stored as { left?: unknown; right?: unknown }
      if (typeof left === 'boolean') columns.left = left
      if (typeof right === 'boolean') columns.right = right
    }
  } catch {
    // nothing stored that can be read: the columns start as they fit
  }
  return columns
}

function storeOpenColumns(columns: OpenColumns): void {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns))
  } catch {
    // without storage the choice simply lasts until the app is closed
  }
}

interface ColumnTabProps {
  side: 'left' | 'right'
  open: boolean
  controls: string
  label: string
  onToggle: () => void
}

/** The tab on the edge of a column that folds it away, or on the edge of the screen that brings it back. */
function ColumnTab({ side, open, controls, label, onToggle }: ColumnTabProps) {
  // the arrow points where the column will go
  const pointsLeft = side === 'left' ? open : !open
  const place =
    side === 'left'
      ? `rounded-r-control border-l-0 ${open ? 'left-[var(--left-width)]' : 'left-0'}`
      : `rounded-l-control border-r-0 ${open ? 'right-[var(--right-width)]' : 'right-0'}`

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={`absolute top-1/2 z-[5] flex h-20 w-6 -translate-y-1/2 items-center justify-center border border-line bg-raised text-muted hover:text-text touch:w-8 ${place}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d={pointsLeft ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

// Written out in full, so that Tailwind finds the classes.
const WIDE_COLUMNS = {
  both: 'xl:grid-cols-[var(--left-width)_minmax(0,1fr)_var(--right-width)]',
  left: 'xl:grid-cols-[var(--left-width)_minmax(0,1fr)]',
  right: 'xl:grid-cols-[minmax(0,1fr)_var(--right-width)]',
  none: 'xl:grid-cols-[minmax(0,1fr)]',
}

interface ColumnHandleProps {
  side: 'left' | 'right'
  width: number
  label: string
  /** Asked for a width in pixels; what is possible is decided by whoever shows the columns. */
  onResize: (width: number) => void
  /** The edges of the area the columns stand in, to tell the width from where the pointer is. */
  edges: () => { left: number; right: number } | undefined
}

/**
 * The inner edge of a side column, to be dragged: wider for more cards side by side,
 * narrower for more of the binder. The arrow keys do the same; a double click sets the
 * width back.
 */
function ColumnHandle({ side, width, label, onResize, edges }: ColumnHandleProps) {
  const [dragging, setDragging] = useState(false)

  function follow(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const area = edges()
    if (area) onResize(side === 'left' ? event.clientX - area.left : area.right - event.clientX)
  }
  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    // towards the binder makes the column wider
    const wider = (event.key === 'ArrowRight') === (side === 'left')
    onResize(width + (wider ? 16 : -16))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      data-testid={`resize-${side}`}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={follow}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => onResize(DEFAULT_COLUMN_WIDTH)}
      onKeyDown={handleKey}
      className={`absolute inset-y-0 z-[4] w-2 cursor-col-resize touch-none focus-visible:outline-none ${
        side === 'left' ? 'left-[var(--left-width)] -translate-x-1/2' : 'right-[var(--right-width)] translate-x-1/2'
      } ${dragging ? 'bg-accent/60' : 'hover:bg-accent/40 focus-visible:bg-accent/40'}`}
    />
  )
}

/**
 * Header, three columns, footer. Both outer columns fold away at the push of the tab on
 * their edge, which leaves the binder more room. The search always stands beside the
 * binder, so that cards can be dragged across. The selection does too where the screen is
 * wide enough; on a narrow one (a tablet upright, a small window) it slides over the binder.
 * A phone shows one of the three at a time.
 */
export function AppLayout({ header, left, center, right, footer, page }: AppLayoutProps) {
  const [stored, setOpen] = useState(readOpenColumns)
  const [widths, setWidths] = useState(readColumnWidths)
  const columns = useRef<HTMLDivElement>(null)
  // While cards are ticked off ("Sammlung") nothing is dragged in, so the search makes
  // room for the binder. The tab still brings it back; that is not remembered.
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const binderOpen = useBinderStore((state) => state.binder !== null)
  const searchShownWhileCollecting = useEditorStore((state) => state.searchShownWhileCollecting)
  const foldedForCollecting = collecting && binderOpen
  // the tray takes the place of the search and is there to be dragged to: it is always shown
  const trayShown = useEditorStore((state) => state.showTray) && binderOpen
  const open: OpenColumns = trayShown
    ? { ...stored, left: true }
    : foldedForCollecting
      ? { ...stored, left: searchShownWhileCollecting }
      : stored

  function toggle(side: keyof OpenColumns) {
    if (side === 'left' && foldedForCollecting) {
      useEditorStore.getState().showSearchWhileCollecting(!searchShownWhileCollecting)
      return
    }
    const next = { ...stored, [side]: !stored[side] }
    setOpen(next)
    storeOpenColumns(next)
  }

  /** Gives a side column another width, as far as the binder between them keeps its room. */
  function resize(side: keyof ColumnWidths, wanted: number) {
    const area = columns.current?.getBoundingClientRect().width ?? window.innerWidth
    const other = side === 'left' ? (open.right ? widths.right : 0) : open.left ? widths.left : 0
    const next = { ...widths, [side]: clampColumnWidth(wanted, area, other) }
    setWidths(next)
    storeColumnWidths(next)
  }
  const edges = () => columns.current?.getBoundingClientRect()
  const widthStyle = { '--left-width': `${widths.left}px`, '--right-width': `${widths.right}px` } as CSSProperties

  const wideColumns =
    WIDE_COLUMNS[open.left && open.right ? 'both' : open.left ? 'left' : open.right ? 'right' : 'none']
  const narrowColumns = open.left
    ? 'grid-cols-[var(--left-width)_minmax(0,1fr)]'
    : 'grid-cols-[minmax(0,1fr)]'

  // A phone has room for one of the three at a time; a bar at the bottom switches between
  // them. The elements stay the same as on a wide screen, only how they are laid out
  // differs, so that nothing loses its state when the screen is turned.
  const phone = useIsPhone()
  const pane = useEditorStore((state) => state.pane)
  const showPane = useEditorStore((state) => state.showPane)
  const shown = (which: AppPane, wide: boolean) => (phone ? pane === which : wide)

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      {header}
      {page !== undefined && (
        <main data-testid="page" className="min-h-0 flex-1 overflow-auto">
          {page}
        </main>
      )}
      <div
        ref={columns}
        style={widthStyle}
        className={
          page !== undefined
            ? 'hidden'
            : phone
              ? 'min-h-0 flex-1'
              : `relative grid min-h-0 flex-1 ${narrowColumns} ${wideColumns}`
        }
      >
        <aside
          id="column-left"
          data-testid="column-left"
          className={`min-h-0 overflow-y-auto bg-panel ${phone ? 'h-full' : 'border-r border-line'} ${
            shown('search', open.left) ? '' : 'hidden'
          }`}
        >
          {left}
        </aside>
        <main
          data-testid="column-center"
          className={`min-h-0 overflow-auto ${phone ? 'h-full' : ''} ${shown('binder', true) ? '' : 'hidden'}`}
        >
          {center}
        </main>
        <aside
          id="column-right"
          data-testid="column-right"
          className={`min-h-0 overflow-y-auto bg-panel ${
            phone
              ? 'h-full'
              : 'border-l border-line max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-10 max-xl:w-[var(--right-width)] max-xl:shadow-2xl'
          } ${shown('selection', open.right) ? '' : 'hidden'}`}
        >
          {right}
        </aside>
        {!phone && (
          <>
            {open.left && (
              <ColumnHandle
                side="left"
                width={widths.left}
                label={de.layout.resizeLeft}
                onResize={(width) => resize('left', width)}
                edges={edges}
              />
            )}
            {open.right && (
              <ColumnHandle
                side="right"
                width={widths.right}
                label={de.layout.resizeRight}
                onResize={(width) => resize('right', width)}
                edges={edges}
              />
            )}
            <ColumnTab
              side="left"
              open={open.left}
              controls="column-left"
              label={open.left ? de.layout.hideSearch : de.layout.showSearch}
              onToggle={() => toggle('left')}
            />
            <ColumnTab
              side="right"
              open={open.right}
              controls="column-right"
              label={open.right ? de.layout.hideSelection : de.layout.showSelection}
              onToggle={() => toggle('right')}
            />
          </>
        )}
      </div>
      {phone && page === undefined && (
        <nav aria-label={de.panes.label} className="flex shrink-0 border-t border-line bg-panel">
          {APP_PANES.map((option) => (
            <button
              key={option}
              type="button"
              aria-current={pane === option ? 'page' : undefined}
              onClick={() => showPane(option)}
              className={`h-14 flex-1 border-t-2 text-sm font-medium ${
                pane === option ? 'border-accent text-accent-hover' : 'border-transparent text-muted'
              }`}
            >
              {option === 'search' && trayShown ? de.tray.pane : de.panes[option]}
            </button>
          ))}
        </nav>
      )}
      {footer}
    </div>
  )
}
