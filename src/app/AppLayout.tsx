import { useState, type ReactNode } from 'react'
import { de } from '../i18n/de'
import { useBinderStore } from '../store/binderStore'
import { useEditorStore } from '../store/editorStore'

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
      ? `rounded-r-control border-l-0 ${open ? 'left-sidebar' : 'left-0'}`
      : `rounded-l-control border-r-0 ${open ? 'right-sidebar' : 'right-0'}`

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
  both: 'xl:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)_var(--spacing-sidebar)]',
  left: 'xl:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]',
  right: 'xl:grid-cols-[minmax(0,1fr)_var(--spacing-sidebar)]',
  none: 'xl:grid-cols-[minmax(0,1fr)]',
}

/**
 * Header, three columns, footer. Both outer columns fold away at the push of the tab on
 * their edge, which leaves the binder more room. The search always stands beside the
 * binder, so that cards can be dragged across. The selection does too where the screen is
 * wide enough; on a narrow one (a tablet upright, a small window) it slides over the binder.
 */
export function AppLayout({ header, left, center, right, footer, page }: AppLayoutProps) {
  const [stored, setOpen] = useState(readOpenColumns)
  // While cards are ticked off ("Sammlung") nothing is dragged in, so the search makes
  // room for the binder. The tab still brings it back; that is not remembered.
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const binderOpen = useBinderStore((state) => state.binder !== null)
  const searchShownWhileCollecting = useEditorStore((state) => state.searchShownWhileCollecting)
  const foldedForCollecting = collecting && binderOpen
  const open: OpenColumns = foldedForCollecting ? { ...stored, left: searchShownWhileCollecting } : stored

  function toggle(side: keyof OpenColumns) {
    if (side === 'left' && foldedForCollecting) {
      useEditorStore.getState().showSearchWhileCollecting(!searchShownWhileCollecting)
      return
    }
    const next = { ...stored, [side]: !stored[side] }
    setOpen(next)
    storeOpenColumns(next)
  }

  const wideColumns =
    WIDE_COLUMNS[open.left && open.right ? 'both' : open.left ? 'left' : open.right ? 'right' : 'none']
  const narrowColumns = open.left
    ? 'grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]'
    : 'grid-cols-[minmax(0,1fr)]'

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      {header}
      {page !== undefined && (
        <main data-testid="page" className="min-h-0 flex-1 overflow-auto">
          {page}
        </main>
      )}
      <div
        className={
          page !== undefined ? 'hidden' : `relative grid min-h-0 flex-1 ${narrowColumns} ${wideColumns}`
        }
      >
        <aside
          id="column-left"
          data-testid="column-left"
          className={`min-h-0 overflow-y-auto border-r border-line bg-panel ${open.left ? '' : 'hidden'}`}
        >
          {left}
        </aside>
        <main data-testid="column-center" className="min-h-0 overflow-auto">
          {center}
        </main>
        <aside
          id="column-right"
          data-testid="column-right"
          className={`min-h-0 overflow-y-auto border-l border-line bg-panel max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-10 max-xl:w-sidebar max-xl:shadow-2xl ${
            open.right ? '' : 'hidden'
          }`}
        >
          {right}
        </aside>
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
      </div>
      {footer}
    </div>
  )
}
