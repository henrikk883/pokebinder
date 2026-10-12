import { useState } from 'react'
import { de } from '../../i18n/de'
import { useDismiss } from '../../lib/useDismiss'
import { SyncConflictDialog } from './SyncConflictDialog'
import { requestSync, resolveConflicts, signIn, signOut, useSyncStore } from './syncStore'

const itemClass = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised'

/**
 * Sync between the collector's devices, in the header: the way to sign in, and once
 * signed in how the sync stands. Not there at all where the app has nothing to sync with.
 */
export function SyncButton() {
  const status = useSyncStore((state) => state.status)
  const email = useSyncStore((state) => state.email)
  const conflicts = useSyncStore((state) => state.conflicts)
  const [open, setOpen] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const menu = useDismiss<HTMLDivElement>(open, () => setOpen(false))

  if (status === 'unknown' || status === 'unavailable') return null
  if (status === 'signedOut') {
    return (
      <button
        type="button"
        title={de.sync.signInHint}
        onClick={signIn}
        className="rounded-control border border-line px-2 py-1 text-sm text-muted hover:border-accent hover:text-text"
      >
        {de.sync.signIn}
      </button>
    )
  }

  if (email === null) return null

  const label = conflicts.length > 0 ? de.sync.conflicts(conflicts.length) : de.sync.status[status]

  return (
    <div
      ref={menu}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="sync-status"
        data-status={conflicts.length > 0 ? 'conflict' : status}
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 rounded-control px-2 py-1 text-sm hover:bg-raised ${
          conflicts.length > 0 ? 'border border-line text-text' : 'text-muted'
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M7 4v14m0 0-4-4m4 4 4-4M17 20V6m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* on a phone the sign alone, unless something is to be done */}
        <span className={conflicts.length > 0 ? '' : 'max-md:sr-only'}>{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={de.sync.menu}
          className="absolute top-full right-0 z-10 mt-2 w-72 rounded-panel border border-line bg-panel p-1 shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-20 max-md:z-40 max-md:mt-0 max-md:w-auto"
        >
          <p className="truncate px-3 pt-2 text-xs text-muted">{de.sync.signedInAs(email)}</p>
          <p className="px-3 pb-2 text-xs text-muted">
            {status === 'offline' ? de.sync.offlineHint : de.sync.status[status]}
          </p>
          {conflicts.length > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setDeciding(true)
              }}
              className={itemClass}
            >
              {de.sync.conflicts(conflicts.length)}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              requestSync()
            }}
            className={itemClass}
          >
            {de.sync.syncNow}
          </button>
          <button type="button" role="menuitem" onClick={signOut} className={itemClass}>
            {de.sync.signOut}
          </button>
        </div>
      )}
      {deciding && conflicts.length > 0 && (
        <SyncConflictDialog
          conflicts={conflicts}
          onApply={(decisions) => {
            setDeciding(false)
            void resolveConflicts(decisions)
          }}
          onCancel={() => setDeciding(false)}
        />
      )}
    </div>
  )
}
