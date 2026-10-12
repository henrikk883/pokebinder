import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import type { Binder } from '../../types/binder'
import { countCards } from './binderModel'
import { NewBinderDialog } from './NewBinderDialog'

type Listing = { status: 'loading' } | { status: 'ready'; binders: Binder[] } | { status: 'error' }

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

/** "Meine Binder": every stored binder, with the way to a new one. */
export function BinderList() {
  const openBinder = useBinderStore((state) => state.openBinder)
  const adoptBinder = useBinderStore((state) => state.adoptBinder)
  const [listing, setListing] = useState<Listing>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    // a binder that was just closed may still be on its way to the database
    const saved = binderStore.getState().whenSaved()
    saved.then(() => binderRepository.listBinders()).then(
      (binders) => {
        if (!cancelled) setListing({ status: 'ready', binders })
      },
      () => {
        if (!cancelled) setListing({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [version])

  async function handleDelete(binder: Binder) {
    if (!window.confirm(de.binderList.confirmDelete(binder.name))) return
    await binderRepository.deleteBinder(binder.id)
    setVersion((current) => current + 1)
  }

  return (
    <section className="mx-auto flex h-full max-w-3xl flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{de.binderList.title}</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <span aria-hidden="true">+</span>
          {de.binderList.create}
        </button>
      </div>

      {listing.status === 'error' && (
        <p role="alert" className="mt-5 text-sm text-muted">
          {de.binderList.loadFailed}
        </p>
      )}
      {listing.status === 'ready' && listing.binders.length === 0 && (
        <div className="mt-5 flex min-h-64 flex-1 items-center justify-center rounded-panel border border-dashed border-line bg-panel">
          <p className="text-sm text-muted">{de.binderList.empty}</p>
        </div>
      )}
      {listing.status === 'ready' && listing.binders.length > 0 && (
        <ul className="mt-5 space-y-3">
          {listing.binders.map((binder) => (
            <li
              key={binder.id}
              className="flex items-center gap-4 rounded-panel border border-line bg-panel p-4"
            >
              <button
                type="button"
                aria-label={de.binderList.open(binder.name)}
                onClick={() => openBinder(binder)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-lg font-medium hover:text-accent-hover">
                  {binder.name}
                </span>
                <span className="block text-sm text-muted">
                  {de.binderList.summary(binder.layout, binder.pages.length, countCards(binder))}
                  {' · '}
                  {dateFormat.format(new Date(binder.updatedAt))}
                </span>
              </button>
              <button
                type="button"
                aria-label={de.binderList.deleteLabel(binder.name)}
                onClick={() => handleDelete(binder)}
                className="h-9 shrink-0 rounded-control border border-danger/60 px-3 text-sm text-danger hover:bg-danger/10"
              >
                {de.binderList.delete}
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewBinderDialog
          onCancel={() => setCreating(false)}
          onCreate={(binder) => {
            setCreating(false)
            adoptBinder(binder)
          }}
        />
      )}
    </section>
  )
}
