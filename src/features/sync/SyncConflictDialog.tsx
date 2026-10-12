import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import type { SyncConflict, SyncDecisions } from './syncRun'

interface SyncConflictDialogProps {
  conflicts: readonly SyncConflict[]
  onApply: (decisions: SyncDecisions) => void
  onCancel: () => void
}

// with seconds: two versions of a binder may lie in the same minute
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'medium' })
const when = (iso: string) => dateTime.format(new Date(iso))
const optionClass =
  'flex cursor-pointer items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 has-checked:border-accent'

/**
 * Asked when binders were changed on this device and on another one before they could be
 * synced: which version of each is to stay. The later one is chosen to begin with.
 */
export function SyncConflictDialog({ conflicts, onApply, onCancel }: SyncConflictDialogProps) {
  const [decisions, setDecisions] = useState<SyncDecisions>(() =>
    Object.fromEntries(
      conflicts.map((conflict) => [
        conflict.id,
        conflict.remoteUpdatedAt > conflict.localUpdatedAt ? 'remote' : 'local',
      ]),
    ),
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onApply(decisions)
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
        aria-labelledby="sync-conflict-title"
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 text-left shadow-lg"
      >
        <h2 id="sync-conflict-title" className="text-xl font-semibold text-text">
          {de.sync.conflictTitle}
        </h2>
        <p className="text-sm text-muted">{de.sync.conflictHint}</p>

        <ul className="min-h-0 space-y-2 overflow-y-auto">
          {conflicts.map((conflict) => (
            <li key={conflict.id}>
              <fieldset className="space-y-2 rounded-control border border-line bg-raised p-3 text-sm">
                <legend className="max-w-full truncate px-1 font-medium text-text">{conflict.name}</legend>
                {(['local', 'remote'] as const).map((side) => (
                  <label key={side} className={optionClass}>
                    <input
                      type="radio"
                      name={`sync-conflict-${conflict.id}`}
                      checked={decisions[conflict.id] === side}
                      onChange={() => setDecisions({ ...decisions, [conflict.id]: side })}
                      className="size-4 shrink-0 accent-accent"
                    />
                    {side === 'local'
                      ? de.sync.keepLocal(when(conflict.localUpdatedAt))
                      : de.sync.keepRemote(when(conflict.remoteUpdatedAt))}
                  </label>
                ))}
              </fieldset>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.sync.later}
          </button>
          <button
            type="submit"
            autoFocus
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {de.sync.apply}
          </button>
        </div>
      </form>
    </div>
  )
}
