import { useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { countProgress } from './binderModel'
import { loadBinderValue, type BinderValue } from './binderValue'

type Valuation =
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; value: BinderValue; binder: Binder }
  | { status: 'error' }

/** Cardmarket value of the binder, worked out on request because it needs a request per card. */
function BinderWorth({ binder }: { binder: Binder }) {
  const [valuation, setValuation] = useState<Valuation>()

  async function calculate() {
    setValuation({ status: 'loading', done: 0, total: 0 })
    try {
      const value = await loadBinderValue(binder, (done, total) => setValuation({ status: 'loading', done, total }))
      setValuation({ status: 'ready', value, binder })
    } catch {
      setValuation({ status: 'error' })
    }
  }

  if (valuation?.status === 'loading') {
    return (
      <span role="status" className="text-muted">
        {de.price.calculating(valuation.done, valuation.total)}
      </span>
    )
  }

  // a value is only shown for the binder as it is now; after a change it is worked out anew
  const current = valuation?.status === 'ready' && valuation.binder === binder ? valuation.value : undefined
  return (
    <>
      {current && (
        <span data-testid="binder-value">
          {de.price.value(current.owned, current.missing)}
          {current.unpriced > 0 && <span className="text-muted"> · {de.price.unpriced(current.unpriced)}</span>}
        </span>
      )}
      {valuation?.status === 'error' && (
        <span role="alert" className="text-muted">
          {de.price.failed}
        </span>
      )}
      {!current && (
        <button
          type="button"
          onClick={calculate}
          className="h-8 rounded-control border border-line bg-raised px-3 text-xs hover:border-accent"
        >
          {de.price.calculate}
        </button>
      )}
    </>
  )
}

/** How much of the binder is collected: "142 / 191 Karten gesammelt · 49 fehlen". */
export function ProgressBar({ binder }: { binder: Binder }) {
  const { total, owned, missing } = countProgress(binder)
  if (total === 0) return null

  return (
    <div data-testid="progress" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
      <span>{de.progress.collected(owned, total)}</span>
      <div
        role="progressbar"
        aria-label={de.progress.bar}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={owned}
        className="h-2 w-64 max-w-[40%] overflow-hidden rounded-full bg-raised"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${(owned / total) * 100}%` }} />
      </div>
      <span className="text-muted">{de.progress.missing(missing)}</span>
      <BinderWorth binder={binder} />
    </div>
  )
}
