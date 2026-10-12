import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'

type Loaded =
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; lines: string[]; skipped: number }
  | { status: 'error' }

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

/**
 * The missing cards of a binder as the text Cardmarket takes for a wants list: to be
 * copied here and pasted there under "Add Decklist". The binder is taken as it was when
 * the window was opened.
 */
export function CardmarketDialog({ binder, onClose }: { binder: Binder; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading', done: 0, total: 0 })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const transfer = await import('./missingListTransfer')
        const list = await transfer.loadCardmarketList(binder, (done, total) => {
          if (!cancelled) setLoaded({ status: 'loading', done, total })
        })
        if (!cancelled) setLoaded({ status: 'ready', ...list })
      } catch {
        if (!cancelled) setLoaded({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [binder])

  const text = loaded.status === 'ready' ? loaded.lines.join('\n') : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardmarket-title"
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="cardmarket-title" className="text-xl font-semibold">
          {de.cardmarket.title(binder.name)}
        </h2>
        <p className="text-sm text-muted">{de.cardmarket.hint}</p>

        {loaded.status === 'loading' && (
          <p role="status" className="text-sm text-muted">
            {de.missingList.working(loaded.done, loaded.total)}
          </p>
        )}
        {loaded.status === 'error' && (
          <p role="alert" className="text-sm text-muted">
            {de.missingList.failed}
          </p>
        )}
        {loaded.status === 'ready' && (
          <>
            {loaded.lines.length === 0 ? (
              <p className="text-sm">{de.cardmarket.empty}</p>
            ) : (
              <textarea
                readOnly
                value={text}
                aria-label={de.cardmarket.list}
                rows={Math.min(14, Math.max(4, loaded.lines.length))}
                onFocus={(event) => event.target.select()}
                className="min-h-0 w-full resize-y rounded-control border border-line bg-raised p-3 font-mono text-xs focus:border-accent focus:outline-none"
              />
            )}
            <p data-testid="cardmarket-summary" className="text-xs text-muted">
              {de.cardmarket.summary(loaded.lines.length)}
              {loaded.skipped > 0 && ` ${de.cardmarket.skipped(loaded.skipped)}`}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              {de.cardmarket.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass}>
            {de.history.close}
          </button>
          {loaded.status === 'ready' && loaded.lines.length > 0 && (
            <button
              type="button"
              autoFocus
              onClick={() => {
                void navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => undefined,
                )
              }}
              className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {copied ? de.cardmarket.copied : de.cardmarket.copy}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
