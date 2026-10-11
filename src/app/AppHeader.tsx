import { de } from '../i18n/de'

export function AppHeader() {
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
      <nav className="border-l border-line pl-6 text-sm text-muted">{de.header.myBinders}</nav>
    </header>
  )
}
