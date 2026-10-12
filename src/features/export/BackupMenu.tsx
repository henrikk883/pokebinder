import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { BackupError, backupReminder, type BackupReminder } from './backup'
import {
  applyImport,
  downloadBackup,
  downloadFullBackup,
  lastFullBackup,
  readBackupFile,
  type PendingImport,
} from './backupTransfer'
import { ImportDialog } from './ImportDialog'
import { replacesSomething, suggestedImport } from './importPlan'

const itemClass =
  'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent'

/**
 * Whether it is time to save everything to a file again. Binders live in this browser
 * only, so a backup that is missing or old is worth a word.
 */
function useBackupReminder(lastBackup: string | null): BackupReminder {
  const binderId = useBinderStore((state) => state.binder?.id)
  const listVersion = useEditorStore((state) => state.binderListVersion)
  const [hasBinders, setHasBinders] = useState(false)

  useEffect(() => {
    let cancelled = false
    binderStore
      .getState()
      .whenSaved()
      .then(() => binderRepository.listBinders())
      .then(
        (binders) => {
          if (!cancelled) setHasBinders(binders.length > 0)
        },
        () => undefined,
      )
    return () => {
      cancelled = true
    }
  }, [binderId, listVersion])

  return backupReminder(lastBackup, new Date().toISOString(), hasBinders || binderId !== undefined)
}

export function BackupMenu() {
  const binder = useBinderStore((state) => state.binder)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastBackup, setLastBackup] = useState(lastFullBackup)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const reminder = useBackupReminder(lastBackup)

  async function handleExport() {
    if (!binder) return
    setOpen(false)
    setError(null)
    try {
      await downloadBackup(binder)
    } catch {
      setError(de.backup.exportFailed)
    }
  }

  async function handleFullBackup() {
    setOpen(false)
    setError(null)
    try {
      await downloadFullBackup()
      setLastBackup(lastFullBackup())
    } catch {
      setError(de.backup.exportFailed)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setOpen(false)
    setError(null)
    try {
      const read = await readBackupFile(file)
      // a file that would replace binders of this device is shown first
      if (replacesSomething(read.entries)) setPending(read)
      else await store(read, suggestedImport(read.entries))
    } catch (cause) {
      setError(cause instanceof BackupError ? de.backup.errors[cause.code] : de.backup.importFailed)
    }
  }

  async function store(read: PendingImport, binderIds: string[]) {
    setPending(null)
    try {
      await applyImport(read, binderIds)
      const [only] = read.entries
      // A file with one binder opens that binder, as this device now has it; with several,
      // they are shown on the shelf. Either way nothing stale stays open.
      const opened =
        read.entries.length === 1 && only
          ? (await binderRepository.listBinders()).find((binder) => binder.id === only.binder.id)
          : undefined
      if (opened) binderStore.getState().openBinder(opened)
      else binderStore.getState().closeBinder()
      useEditorStore.getState().refreshBinderList()
    } catch {
      setError(de.backup.importFailed)
    }
  }

  return (
    <div
      className="relative flex items-center gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      {error && (
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
      )}
      {reminder.kind !== 'none' && (
        <button
          type="button"
          data-testid="backup-reminder"
          title={de.backup.reminderHint}
          onClick={handleFullBackup}
          className="rounded-control border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-text"
        >
          {reminder.kind === 'never' ? de.backup.neverSaved : de.backup.savedDaysAgo(reminder.days)}
        </button>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-control px-2 py-1 text-sm font-medium text-accent-hover hover:bg-raised"
      >
        {de.backup.button}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-2 w-72 rounded-panel border border-line bg-panel p-1 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={handleFullBackup} className={itemClass}>
            {de.backup.saveAll}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!binder}
            onClick={handleExport}
            className={itemClass}
          >
            {de.backup.export}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => fileInput.current?.click()}
            className={itemClass}
          >
            {de.backup.import}
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label={de.backup.fileInput}
        onChange={handleImport}
        className="hidden"
      />
      {pending && (
        <ImportDialog
          entries={pending.entries}
          withWatchlists={pending.watchlists !== undefined}
          onImport={(binderIds) => store(pending, binderIds)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
