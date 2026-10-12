import { useState } from 'react'
import { de } from '../../i18n/de'
import { ShoppingDialog } from '../export/ShoppingDialog'
import type { SavedCard } from './watchlist'
import { loadListShoppingRows, loadListValue, type ListValue } from './watchlistValue'

type Valuation =
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; value: ListValue; cards: readonly SavedCard[] }
  | { status: 'error' }

/**
 * What the cards of a list would cost at Cardmarket, worked out on request because it
 * needs requests per card. Like the value of a binder.
 */
export function ListWorth({ cards, name }: { cards: readonly SavedCard[]; name: string }) {
  const [valuation, setValuation] = useState<Valuation>()
  const [shopping, setShopping] = useState<readonly SavedCard[] | null>(null)

  async function calculate() {
    setValuation({ status: 'loading', done: 0, total: cards.length })
    try {
      const value = await loadListValue(cards, (done, total) => setValuation({ status: 'loading', done, total }))
      setValuation({ status: 'ready', value, cards })
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

  // a sum is only shown for the list as it is now; after a change it is worked out anew
  const current = valuation?.status === 'ready' && valuation.cards === cards ? valuation.value : undefined
  return (
    <>
      {current && (
        <span data-testid="list-value" title={de.watchlist.totalHint}>
          {de.watchlist.total(current.total)}
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
          className="h-8 shrink-0 rounded-control border border-line bg-raised px-3 text-xs hover:border-accent"
        >
          {de.price.calculate}
        </button>
      )}
      <button
        type="button"
        onClick={() => setShopping(cards)}
        className="h-8 shrink-0 rounded-control border border-line bg-raised px-3 text-xs hover:border-accent"
      >
        {de.shopping.menu}
      </button>
      {shopping && (
        <ShoppingDialog
          title={de.shopping.title(name)}
          load={(onProgress) => loadListShoppingRows(shopping, onProgress)}
          onClose={() => setShopping(null)}
        />
      )}
    </>
  )
}
