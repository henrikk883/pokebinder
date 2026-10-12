import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { BinderCover } from './BinderCover'
import { countCards, renameBinder } from './binderModel'
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
  const listVersion = useEditorStore((state) => state.binderListVersion)

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
  }, [version, listVersion])

  async function handleRename(binder: Binder) {
    const name = await promptDialog({
      title: de.binder.rename,
      label: de.newBinder.name,
      value: binder.name,
      confirmLabel: de.binder.renameConfirm,
    })
    if (name === null) return
    await binderRepository.saveBinder(renameBinder(binder, name))
    setVersion((current) => current + 1)
  }

  async function handleDelete(binder: Binder) {
    const agreed = await confirmDialog({
      title: de.binderList.deleteTitle(binder.name),
      text: de.binderList.confirmDelete,
      confirmLabel: de.binderList.delete,
      danger: true,
    })
    if (!agreed) return
    await binderRepository.deleteBinder(binder.id)
    setVersion((current) => current + 1)
    // others that count binders (the backup reminder) should notice too
    useEditorStore.getState().refreshBinderList()
  }

  return (
    <section className="mx-auto flex h-full max-w-5xl flex-col p-5">
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
        // a shelf: the binders stand side by side, each showing its cover
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-5 gap-y-7">
          {listing.binders.map((binder) => (
            <li key={binder.id} data-testid="binder-tile" className="shelf-item flex min-w-0 flex-col">
              <button
                type="button"
                aria-label={de.binderList.open(binder.name)}
                onClick={() => openBinder(binder)}
                className="group block w-full text-left"
              >
                <BinderCover binder={binder} />
                <span className="mt-3 block truncate text-base font-medium group-hover:text-accent-hover">
                  {binder.name}
                </span>
                <span className="block text-xs text-muted">
                  {de.binderList.summary(binder.layout, binder.pages.length, countCards(binder))}
                </span>
                <span className="block text-xs text-muted">
                  {dateFormat.format(new Date(binder.updatedAt))}
                </span>
              </button>
              <div className="shelf-actions mt-2 flex gap-2">
                <button
                  type="button"
                  aria-label={de.binderList.renameLabel(binder.name)}
                  onClick={() => handleRename(binder)}
                  className="h-8 min-w-0 flex-1 rounded-control border border-line bg-raised px-2 text-xs hover:border-accent"
                >
                  {de.binderList.rename}
                </button>
                <button
                  type="button"
                  aria-label={de.binderList.deleteLabel(binder.name)}
                  onClick={() => handleDelete(binder)}
                  className="h-8 min-w-0 flex-1 rounded-control border border-danger/60 px-2 text-xs text-danger hover:bg-danger/10"
                >
                  {de.binderList.delete}
                </button>
              </div>
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
