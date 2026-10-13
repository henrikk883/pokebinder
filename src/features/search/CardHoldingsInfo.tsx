import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore } from '../../store/binderStore'
import { CARD_LANGS, type CardLang } from '../../types/binder'
import { holdingsOf, type CardHoldings } from '../binder/cardHoldings'
import { LangFlag } from './LanguageSelect'

interface CardHoldingsInfoProps {
  cardId: string
}

/** The flag of a language, readable as its name. */
function Lang({ lang }: { lang: CardLang }) {
  return (
    <span title={de.languages[lang]} className="inline-flex shrink-0 scale-75 self-center">
      <LangFlag lang={lang} />
      <span className="sr-only">{de.languages[lang]}</span>
    </span>
  )
}

/**
 * In a card's info: how often the card is in the collection, in which languages, and in
 * which binders it lies.
 */
export function CardHoldingsInfo({ cardId }: CardHoldingsInfoProps) {
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
  // the copies per language, for a card that is there in more than one
  const perLang = CARD_LANGS.flatMap((lang) => {
    const copies = (holdings?.places ?? []).reduce((sum, place) => sum + (place.lang === lang ? place.copies : 0), 0)
    return copies > 0 ? [{ lang, copies }] : []
  })

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
            <p className="flex flex-wrap items-baseline gap-x-3 font-medium">
              {de.holdings.copies(holdings.copies)}
              {perLang.length > 1 &&
                perLang.map(({ lang, copies }) => (
                  <span key={lang} data-testid="holdings-lang" className="flex items-baseline gap-1 font-normal text-muted">
                    <Lang lang={lang} />
                    {de.holdings.times(copies)}
                  </span>
                ))}
            </p>
            <ul className="mt-1 space-y-1">
              {holdings.places.map((place) => (
                <li key={`${place.binderId}:${place.lang}`} className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <Lang lang={place.lang} />
                    <span className="min-w-0 truncate" title={place.binderName}>
                      {place.binderName}
                      <span className="text-muted">{` · ${de.holdings.pages(place.pages)}`}</span>
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
