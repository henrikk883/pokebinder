import { BackupMenu } from '../features/export/BackupMenu'
import { de } from '../i18n/de'
import { useBinderStore } from '../store/binderStore'
import { SaveStatusBadge } from './SaveStatusBadge'

export function AppHeader() {
  const binderName = useBinderStore((state) => state.binder?.name)

  return (
    <header className="flex h-header shrink-0 items-center gap-6 border-b border-line bg-panel px-5">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
          <rect x="3" y="2" width="4" height="20" rx="1.5" className="fill-accent-hover" />
          <rect x="8" y="2" width="13" height="20" rx="2.5" className="fill-accent" />
          <circle cx="14.5" cy="12" r="2.5" className="fill-bg" />
        </svg>
        <span className="text-xl font-semibold tracking-tight">{de.app.name}</span>
      </div>
      <nav className="flex items-center gap-3 border-l border-line pl-6 text-sm text-muted">
        <span>{de.header.myBinders}</span>
        {binderName !== undefined && (
          <>
            <span aria-hidden="true">/</span>
            <span className="text-text">{binderName}</span>
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-5">
        <SaveStatusBadge />
        <BackupMenu />
      </div>
    </header>
  )
}
