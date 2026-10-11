import { useRef, useState, type ChangeEvent } from 'react'
import { de } from '../../i18n/de'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { BackupError } from './backup'
import { downloadBackup, importBackup } from './backupTransfer'

const itemClass =
  'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent'

export function BackupMenu() {
  const binder = useBinderStore((state) => state.binder)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setOpen(false)
    setError(null)
    try {
      binderStore.getState().openBinder(await importBackup(file))
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
          className="absolute top-full right-0 z-10 mt-2 w-56 rounded-panel border border-line bg-panel p-1 shadow-lg"
        >
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
