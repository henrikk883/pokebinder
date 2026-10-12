import { useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { useDismiss } from '../../lib/useDismiss'
import { CardmarketDialog } from './CardmarketDialog'

type Progress = (done: number, total: number) => void
type Exporter = 'downloadMissingList' | 'downloadMissingListCsv' | 'downloadProxies'

const menuItemClass = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised'

const ENTRIES: readonly { exporter: Exporter; label: string }[] = [
  { exporter: 'downloadMissingList', label: de.missingList.asPdf },
  { exporter: 'downloadMissingListCsv', label: de.missingList.asCsv },
  { exporter: 'downloadProxies', label: de.missingList.proxies },
]

/** "Was fehlt?": the missing cards as PDF checklist, as table for Excel, as placeholders to print, or as a list for Cardmarket. */
export function MissingListMenu({ binder, buttonClass }: { binder: Binder; buttonClass: string }) {
  const [open, setOpen] = useState(false)
  const menu = useDismiss<HTMLDivElement>(open, () => setOpen(false))
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  // the list is of the binder as it was when asked for; later changes do not move it
  const [forCardmarket, setForCardmarket] = useState<Binder | null>(null)

  async function run(exporter: Exporter) {
    setOpen(false)
    setFailed(false)
    setProgress({ done: 0, total: 0 })
    const report: Progress = (done, total) => setProgress({ done, total })
    try {
      // PDF library and export code are large and only needed here, so they are loaded on demand
      const transfer = await import('./missingListTransfer')
      await transfer[exporter](binder, report)
    } catch {
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

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
        disabled={progress !== null}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={buttonClass}
      >
        {progress ? de.missingList.working(progress.done, progress.total) : de.missingList.menu}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-1 shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-20 max-md:z-40 max-md:mt-0 max-md:max-h-[60vh] max-md:w-auto max-md:overflow-y-auto">
          {ENTRIES.map((entry) => (
            <button
              key={entry.exporter}
              type="button"
              role="menuitem"
              onClick={() => run(entry.exporter)}
              className={menuItemClass}
            >
              {entry.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setForCardmarket(binder)
            }}
            className={`${menuItemClass} mt-1 border-t border-line pt-2`}
          >
            {de.cardmarket.menu}
          </button>
        </div>
      )}
      {forCardmarket && <CardmarketDialog binder={forCardmarket} onClose={() => setForCardmarket(null)} />}
      {failed && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-3 text-sm text-muted shadow-lg">
          {de.missingList.failed}
        </p>
      )}
    </div>
  )
}
