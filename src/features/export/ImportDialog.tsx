import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { canChoose, suggestedImport, type ImportEntry } from './importPlan'

interface ImportDialogProps {
  entries: readonly ImportEntry[]
  /** The file also brings "Merklisten", which are merged with those of this device. */
  withWatchlists: boolean
  /** The file also brings decks; those that are new or newer are taken. */
  withDecks?: boolean
  onImport: (binderIds: string[]) => void
  onCancel: () => void
}

// with seconds: two versions of a binder may lie in the same minute
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'medium' })
const when = (iso: string) => dateTime.format(new Date(iso))
const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

/**
 * Asked before a backup replaces binders of this device: which side has the later version
 * of each, and which ones are to be read. What is new or newer is ticked to begin with.
 */
export function ImportDialog({ entries, withWatchlists, withDecks = false, onImport, onCancel }: ImportDialogProps) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(suggestedImport(entries)))

  function toggle(binderId: string, checked: boolean) {
    const next = new Set(chosen)
    if (checked) next.add(binderId)
    else next.delete(binderId)
    setChosen(next)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onImport(entries.map((entry) => entry.binder.id).filter((id) => chosen.has(id)))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 text-left shadow-lg"
      >
        <h2 id="import-title" className="text-xl font-semibold text-text">
          {de.importDialog.title}
        </h2>
        <p className="text-sm text-muted">{de.importDialog.hint}</p>

        <ul className="min-h-0 space-y-2 overflow-y-auto">
          {entries.map((entry) => {
            const { binder, kind, local } = entry
            return (
              <li key={binder.id} data-testid="import-entry" data-kind={kind}>
                <label
                  className={`flex items-start gap-3 rounded-control border border-line bg-raised p-3 text-sm has-checked:border-accent ${
                    canChoose(entry) ? 'cursor-pointer' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={binder.name}
                    checked={chosen.has(binder.id)}
                    disabled={!canChoose(entry)}
                    onChange={(event) => toggle(binder.id, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">{binder.name}</span>
                    <span className="block text-muted">{de.importDialog.kinds[kind]}</span>
                    {local && kind !== 'same' && (
                      <span className="block text-xs text-muted">
                        {de.importDialog.versions(when(binder.updatedAt), when(local.updatedAt))}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {withWatchlists && <p className="text-sm text-muted">{de.importDialog.watchlists}</p>}
        {withDecks && <p className="text-sm text-muted">{de.importDialog.decks}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className={buttonClass}>
            {de.importDialog.cancel}
          </button>
          <button
            type="submit"
            autoFocus
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {de.importDialog.confirm(chosen.size)}
          </button>
        </div>
      </form>
    </div>
  )
}
