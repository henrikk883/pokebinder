import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { CardTile } from '../search/CardTile'
import { useReadyCatalog } from '../search/useCatalog'
import { useThemeCards, useThemeIds } from './useSimilarCards'

interface ThemeBrowserProps {
  /** Language the cards are shown in where they exist in it. */
  lang: CardLang
  gridClass: string
}

const themeNames: Readonly<Record<string, string>> = de.themes.names

/**
 * On the page "Karten stöbern": cards by what their pictures show – autumn, snow, the sea –
 * to put pages together by mood. An image model has sorted the cards ahead.
 */
export function ThemeBrowser({ lang, gridClass }: ThemeBrowserProps) {
  const ids = useThemeIds()
  const [chosen, setChosen] = useState<string>()
  const found = useThemeCards(chosen, lang)
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
            onClick={() => setChosen(id)}
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
          )}
        </div>
      )}
    </>
  )
}
