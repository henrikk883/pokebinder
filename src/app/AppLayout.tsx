import { useState, type ReactNode } from 'react'
import { de } from '../i18n/de'

interface AppLayoutProps {
  header: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  footer: ReactNode
}

/**
 * Header, three columns, footer. Where the screen is too narrow for three columns (a
 * tablet), the right one is folded away and slides over the binder at the push of the tab
 * on the right edge, so that the binder keeps the room.
 */
export function AppLayout({ header, left, center, right, footer }: AppLayoutProps) {
  const [rightOpen, setRightOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      {header}
      <div className="relative grid min-h-0 flex-1 grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)] xl:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)_var(--spacing-sidebar)]">
        <aside
          data-testid="column-left"
          className="min-h-0 overflow-y-auto border-r border-line bg-panel"
        >
          {left}
        </aside>
        <main data-testid="column-center" className="min-h-0 overflow-auto">
          {center}
        </main>
        <aside
          id="column-right"
          data-testid="column-right"
          className={`min-h-0 overflow-y-auto border-l border-line bg-panel max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-30 max-xl:w-sidebar max-xl:shadow-2xl ${
            rightOpen ? '' : 'max-xl:hidden'
          }`}
        >
          {right}
        </aside>
        <button
          type="button"
          aria-label={rightOpen ? de.layout.hideSelection : de.layout.showSelection}
          aria-expanded={rightOpen}
          aria-controls="column-right"
          onClick={() => setRightOpen((open) => !open)}
          className={`absolute top-1/2 z-40 flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-l-control border border-r-0 border-line bg-raised text-muted hover:text-text xl:hidden ${
            rightOpen ? 'right-sidebar' : 'right-0'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path
              d={rightOpen ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {footer}
    </div>
  )
}
