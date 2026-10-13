import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore } from '../../store/binderStore'
import type { CardLang } from '../../types/binder'
import { holdingsOf, type CardHoldings } from '../binder/cardHoldings'

interface CardHoldingsInfoProps {
  cardId: string
  /** Language the card is looked at in; copies in another language are marked as such. */
  lang: CardLang
}

/** In a card's info: how often the card is in the collection, and in which binders it lies. */
export function CardHoldingsInfo({ cardId, lang }: CardHoldingsInfoProps) {
  const [loaded, setLoaded] = useState<{ cardId: string; holdings: CardHoldings }>()

  useEffect(() => {
    let cancelled = false
    // the open binder may still be on its way to the database
    binderStore
      .getState()
      .whenSaved()
      .then(() => binderRepository.listBinders())
      .then(
        (binders) => {
          if (!cancelled) setLoaded({ cardId, holdings: holdingsOf(binders, cardId) })
        },
        () => undefined,
      )
    return () => {
      cancelled = true
    }
  }, [cardId])

  const holdings = loaded?.cardId === cardId ? loaded.holdings : undefined

  return (
    <div className="space-y-1">
      <dt className="text-muted">{de.holdings.label}</dt>
      <dd data-testid="card-info-holdings">
        {!holdings ? (
          <span className="text-muted">{de.price.loading}</span>
        ) : holdings.places.length === 0 ? (
          <span className="text-muted">{de.holdings.none}</span>
        ) : (
          <>
            <p className="font-medium">{de.holdings.copies(holdings.copies)}</p>
            <ul className="mt-1 space-y-1">
              {holdings.places.map((place) => (
                <li key={`${place.binderId}:${place.lang}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate" title={place.binderName}>
                    {place.binderName}
                    <span className="text-muted">
                      {` · ${de.holdings.pages(place.pages)}`}
                      {place.lang !== lang && ` · ${de.languages[place.lang]}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted">{de.holdings.state(place.copies, place.missing)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </dd>
    </div>
  )
}
