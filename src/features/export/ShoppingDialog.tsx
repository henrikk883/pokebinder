import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useCard } from '../binder/useCard'
import { CardImage } from '../search/CardImage'
import { useReadyCatalog } from '../search/useCatalog'
import {
  cardCount,
  cardmarketUrl,
  parseBudget,
  SHOPPING_ORDERS,
  shoppingTotal,
  sortShopping,
  withinBudget,
  type ShoppingOrder,
  type ShoppingRow,
} from './shopping'

interface ShoppingDialogProps {
  title: string
  /** What the list is, in a sentence under the title. */
  hint?: string
  /** Said when the list has no lines. */
  emptyText?: string
  /** A list of cards to give away has no use for a budget. */
  withBudget?: boolean
  /** Looks the cards and their prices up; `onProgress` reports how far that is. */
  load: (onProgress: (done: number, total: number) => void) => Promise<ShoppingRow[]>
  onClose: () => void
}

type Loading =
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; rows: ShoppingRow[] }
  | { status: 'error' }

const fieldClass = 'h-10 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none'

function Line({ row, dimmed }: { row: ShoppingRow; dimmed: boolean }) {
  const card = useCard(row.cardId, row.lang)
  const catalog = useReadyCatalog(row.lang)

  return (
    <li
      data-testid="shopping-row"
      data-card-id={row.cardId}
      data-affordable={!dimmed}
      className={`flex items-center gap-3 rounded-control border border-line bg-raised p-2 text-sm ${dimmed ? 'opacity-45' : ''}`}
    >
      <span className="w-9 shrink-0">
        {card ? (
          <CardImage card={card} set={catalog?.setsById.get(setIdOfCard(card))} size="small" />
        ) : (
          <span className="block aspect-[63/88] w-full rounded-pocket bg-panel" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-text">{row.name}</span>
        <span className="block truncate text-xs text-muted">
          {[row.setName, row.number, de.variantLabel(row.variant)].filter((part) => part !== '').join(' · ')}
        </span>
      </span>
      <span data-testid="shopping-price" className={`shrink-0 ${row.price === undefined ? 'text-muted' : 'font-medium'}`}>
        {row.price === undefined
          ? de.price.none
          : (row.count ?? 1) > 1
            ? de.shopping.pieces(row.count ?? 1, de.price.amount(row.price))
            : de.price.amount(row.price)}
      </span>
      <a
        href={cardmarketUrl(row)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={de.shopping.linkLabel(row.name)}
        className="shrink-0 rounded-control border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-text"
      >
        {de.shopping.link}
      </a>
    </li>
  )
}

/**
 * The cards still to buy, with what they cost: cheapest first by default, with the sum and
 * how far a budget would go. Each line links to the card at Cardmarket.
 */
export function ShoppingDialog({
  title,
  hint = de.shopping.hint,
  emptyText = de.shopping.empty,
  withBudget = true,
  load,
  onClose,
}: ShoppingDialogProps) {
  const [loading, setLoading] = useState<Loading>({ status: 'loading', done: 0, total: 0 })
  const [order, setOrder] = useState<ShoppingOrder>('cheapest')
  const [budgetText, setBudgetText] = useState('')

  useEffect(() => {
    let cancelled = false
    load((done, total) => {
      if (!cancelled) setLoading({ status: 'loading', done, total })
    }).then(
      (rows) => {
        if (!cancelled) setLoading({ status: 'ready', rows })
      },
      () => {
        if (!cancelled) setLoading({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is loaded once, for the state it was opened in
  }, [])

  const rows = loading.status === 'ready' ? loading.rows : []
  const { total, unpriced } = shoppingTotal(rows)
  const budget = parseBudget(budgetText)
  const within = budget === undefined || !withBudget ? undefined : withinBudget(rows, budget)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 text-left shadow-lg"
      >
        <div>
          <h2 id="shopping-title" className="text-xl font-semibold text-text">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </div>

        {loading.status === 'loading' && (
          <p role="status" className="text-sm text-muted">
            {de.price.calculating(loading.done, loading.total)}
          </p>
        )}
        {loading.status === 'error' && (
          <p role="alert" className="text-sm text-muted">
            {de.price.failed}
          </p>
        )}
        {loading.status === 'ready' && rows.length === 0 && <p className="text-sm text-muted">{emptyText}</p>}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="space-y-1">
                <span className="block text-muted">{de.shopping.order}</span>
                <select
                  value={order}
                  onChange={(event) => {
                    const next = SHOPPING_ORDERS.find((known) => known === event.target.value)
                    if (next) setOrder(next)
                  }}
                  className={fieldClass}
                >
                  {SHOPPING_ORDERS.map((option) => (
                    <option key={option} value={option}>
                      {de.shopping.orders[option]}
                    </option>
                  ))}
                </select>
              </label>
              {withBudget && (
              <label className="space-y-1">
                <span className="block text-muted">{de.shopping.budget}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetText}
                  onChange={(event) => setBudgetText(event.target.value)}
                  placeholder={de.shopping.budgetPlaceholder}
                  className={`${fieldClass} w-36 placeholder:text-muted`}
                />
              </label>
              )}
              {within && (
                <p data-testid="shopping-budget" className="pb-2 text-text">
                  {de.shopping.within(
                    cardCount(rows.filter((row) => within.affordable.has(row.key))),
                    cardCount(rows),
                    within.spent,
                  )}
                </p>
              )}
            </div>

            <ul className="min-h-0 space-y-2 overflow-y-auto">
              {sortShopping(rows, order).map((row) => (
                <Line key={row.key} row={row} dimmed={within !== undefined && !within.affordable.has(row.key)} />
              ))}
            </ul>

            <p data-testid="shopping-total" className="text-sm font-medium text-text">
              {de.shopping.total(cardCount(rows), total)}
              {unpriced > 0 && <span className="font-normal text-muted"> · {de.price.unpriced(unpriced)}</span>}
            </p>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.cardInfo.close}
          </button>
        </div>
      </div>
    </div>
  )
}
