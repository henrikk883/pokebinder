import type { ReactNode } from 'react'

interface AppLayoutProps {
  header: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  footer: ReactNode
}

export function AppLayout({ header, left, center, right, footer }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-bg text-text">
      {header}
      <div className="grid min-h-0 flex-1 grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)_var(--spacing-sidebar)]">
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
          data-testid="column-right"
          className="min-h-0 overflow-y-auto border-l border-line bg-panel"
        >
          {right}
        </aside>
      </div>
      {footer}
    </div>
  )
}
