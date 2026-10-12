import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { mapWithConcurrency, setIdOfCard, tcgdexFor } from '../../lib/tcgdex'
import { binderStore } from '../../store/binderStore'
import type { Binder } from '../../types/binder'
import { matchTrade, type TradeCard } from './tradeMatch'

interface Row {
  key: string
  name: string
  place: string
  variant: string
  count: number
  price?: number
}

interface Loaded {
  forMe: Row[]
  forThem: Row[]
  /** Whether this device has binders to compare with at all. */
  ownBinders: number
}

/** Name, place in its set and price of the cards of one direction. */
async function describe(cards: readonly TradeCard[]): Promise<Row[]> {
  return mapWithConcurrency(cards, 8, async ({ cardRef, count }, index) => {
    const client = tcgdexFor(cardRef.lang)
    const [card, catalog, price] = await Promise.all([
      client.getCard(cardRef.cardId).catch(() => undefined),
      client.getCatalog().catch(() => undefined),
      client.getPrice(cardRef.cardId, cardRef.variant).catch(() => undefined),
    ])
    const set = card ? catalog?.setsById.get(setIdOfCard(card)) : undefined
    const row: Row = {
      key: `${index}:${cardRef.lang}:${cardRef.cardId}:${cardRef.variant}`,
      name: card?.name ?? cardRef.cardId,
      place: card ? [set?.name, set ? `${card.localId}/${set.cardCount.official}` : card.localId].filter(Boolean).join(' · ') : '',
      variant: de.variantLabel(cardRef.variant),
      count,
    }
    if (price) row.price = price.amount
    return row
  })
}

/** What the cards of one direction are worth together, in cents first so that nothing drifts. */
const worthOf = (rows: readonly Row[]) =>
  rows.reduce((sum, row) => sum + Math.round((row.price ?? 0) * 100) * row.count, 0) / 100

function Direction({ title, empty, rows, testId }: { title: string; empty: string; rows: readonly Row[]; testId: string }) {
  return (
    <section data-testid={testId} className="min-w-0">
      <h3 className="text-base font-semibold">
        {title} <span className="text-sm font-normal text-muted">{rows.reduce((sum, row) => sum + row.count, 0)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-control border border-line bg-raised p-2 text-sm">
            {rows.map((row) => (
              <li key={row.key} data-testid="trade-row" className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {row.count > 1 && <span className="font-medium">{de.decks.copies(row.count)} </span>}
                  {row.name} <span className="text-xs text-muted">· {row.place} · {row.variant}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {row.price === undefined ? de.price.none : de.price.amount(row.price)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">{de.trade.worth(worthOf(rows))}</p>
        </>
      )}
    </section>
  )
}

/**
 * "Tauschabgleich": compares a binder somebody shared with the binders of this device and
 * shows what could change hands in either direction – the spare cards of one that the other
 * is missing. Nothing is sent anywhere; the comparison happens here.
 */
export function TradeMatchDialog({ shared, onClose }: { shared: Binder; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | 'error'>()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // a change made a moment ago must be part of the comparison
        await binderStore.getState().whenSaved()
        const mine = await binderRepository.listBinders()
        const match = matchTrade(mine, [shared])
        const [forMe, forThem] = await Promise.all([describe(match.forMe), describe(match.forThem)])
        if (!cancelled) setLoaded({ forMe, forThem, ownBinders: mine.length })
      } catch {
        if (!cancelled) setLoaded('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shared])

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
        aria-labelledby="trade-match-title"
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="trade-match-title" className="text-xl font-semibold">
          {de.trade.matchTitle(shared.name)}
        </h2>
        <p className="text-sm text-muted">{de.trade.matchHint}</p>

        {loaded === undefined && (
          <p role="status" className="text-sm text-muted">
            {de.trade.matchWorking}
          </p>
        )}
        {loaded === 'error' && (
          <p role="alert" className="text-sm text-muted">
            {de.trade.matchFailed}
          </p>
        )}
        {loaded !== undefined && loaded !== 'error' && (
          <>
            {loaded.ownBinders === 0 && <p className="text-sm">{de.trade.noOwnBinders}</p>}
            <div className="grid gap-5 md:grid-cols-2">
              <Direction title={de.trade.forMe} empty={de.trade.forMeEmpty} rows={loaded.forMe} testId="trade-for-me" />
              <Direction title={de.trade.forThem} empty={de.trade.forThemEmpty} rows={loaded.forThem} testId="trade-for-them" />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.history.close}
          </button>
        </div>
      </div>
    </div>
  )
}
