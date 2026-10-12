import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { CardTile } from '../search/CardTile'
import { useReadyCatalog } from '../search/useCatalog'
import { MoreButton } from './MoreButton'
import { THEME_STEP, useThemeCards, useThemeIds, type ThemeOrder } from './useSimilarCards'

interface ThemeBrowserProps {
  /** Language the cards are shown in where they exist in it. */
  lang: CardLang
  gridClass: string
}

const themeNames: Readonly<Record<string, string>> = de.themes.names
const ORDERS: readonly ThemeOrder[] = ['fit', 'colour']

/**
 * On the page "Karten stöbern": cards by what their pictures show – autumn, snow, the sea –
 * to put pages together by mood. An image model has sorted the cards ahead.
 */
export function ThemeBrowser({ lang, gridClass }: ThemeBrowserProps) {
  const ids = useThemeIds()
  const [chosen, setChosen] = useState<string>()
  const [count, setCount] = useState(THEME_STEP)
  const [order, setOrder] = useState<ThemeOrder>('fit')
  const found = useThemeCards(chosen, lang, count, order)
  const ownSets = useReadyCatalog(lang)?.setsById
  const englishSets = useReadyCatalog('en')?.setsById
  // only the themes that have a name here are offered
  const themes = (ids ?? []).filter((id) => themeNames[id] !== undefined)

  return (
    <>
      <p className="text-sm text-muted">{de.themes.hint}</p>
      {ids === undefined && (
        <p role="status" className="mt-4 text-sm text-muted">
          {de.themes.loading}
        </p>
      )}
      {ids === null && (
        <p role="alert" className="mt-4 text-sm text-muted">
          {de.themes.error}
        </p>
      )}
      <div role="group" aria-label={de.themes.pick} className="mt-4 flex flex-wrap gap-2">
        {themes.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={chosen === id}
            onClick={() => {
              setChosen(id)
              // another theme starts with its best cards again
              setCount(THEME_STEP)
            }}
            className={`h-10 rounded-control border bg-raised px-4 text-sm hover:border-accent ${
              chosen === id ? 'border-accent text-accent-hover' : 'border-line'
            }`}
          >
            {themeNames[id]}
          </button>
        ))}
      </div>
      {chosen !== undefined && (
        <div className="mt-5" data-testid="theme-results">
          <label className="mb-4 flex w-fit items-center gap-2 text-sm text-muted">
            {de.themes.order}
            <select
              value={order}
              onChange={(event) => setOrder(event.target.value === 'colour' ? 'colour' : 'fit')}
              className="h-10 rounded-control border border-line bg-raised px-3 text-sm text-text focus:border-accent focus:outline-none"
            >
              {ORDERS.map((option) => (
                <option key={option} value={option}>
                  {de.themes.orders[option]}
                </option>
              ))}
            </select>
          </label>
          {found.status === 'loading' && (
            <p role="status" className="text-sm text-muted">
              {de.themes.loadingCards}
            </p>
          )}
          {(found.status === 'error' || found.status === 'unknown') && (
            <p role="alert" className="text-sm text-muted">
              {de.themes.error}
            </p>
          )}
          {found.status === 'ready' && (
            <>
              <ul className={gridClass}>
                {found.cards.map(({ card, lang: cardLang }) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    set={(cardLang === lang ? ownSets : englishSets)?.get(setIdOfCard(card))}
                    lang={cardLang}
                    draggable={false}
                    dragIdPrefix={`theme:${chosen}`}
                    browsing
                  />
                ))}
              </ul>
              <MoreButton found={found} onMore={() => setCount(count + THEME_STEP)} />
            </>
          )}
        </div>
      )}
    </>
  )
}
