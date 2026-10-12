import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { BackupError, backupReminder, type BackupReminder } from './backup'
import { downloadBackup, downloadFullBackup, importBackup, lastFullBackup } from './backupTransfer'

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
      const binders = await importBackup(file)
      const [only] = binders
      // one binder is opened right away; several are shown in the list
      if (binders.length === 1 && only) binderStore.getState().openBinder(only)
      else binderStore.getState().closeBinder()
      useEditorStore.getState().refreshBinderList()
    } catch (cause) {
      setError(cause instanceof BackupError ? de.backup.errors[cause.code] : de.backup.importFailed)
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
    </div>
  )
}
