import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { CardTile } from '../search/CardTile'
import { useReadyCatalog } from '../search/useCatalog'
import { MoreButton } from './MoreButton'
import { PICTURE_COLOURS, type PictureColour } from './similarColours'
import { THEME_STEP, useThemeCards, useThemeIds, type ThemeOrder } from './useSimilarCards'

interface ThemeBrowserProps {
  /** Language the cards are shown in where they exist in it. */
  lang: CardLang
  gridClass: string
}

const themeNames: Readonly<Record<string, string>> = de.themes.names
const ORDERS: readonly ThemeOrder[] = ['fit', 'colour']
const selectClass =
  'h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none'

/**
 * On the page "Karten stöbern": cards by what their pictures show – autumn, snow, the sea –
 * and by their colour, to put pages together by mood. An image model has sorted the cards
 * by theme ahead; the colours come from the pictures themselves.
 */
export function ThemeBrowser({ lang, gridClass }: ThemeBrowserProps) {
  const ids = useThemeIds()
  const [themeId, setThemeId] = useState<string>()
  const [colour, setColour] = useState<PictureColour>()
  const [count, setCount] = useState(THEME_STEP)
  const [order, setOrder] = useState<ThemeOrder>('fit')
  const found = useThemeCards({ themeId, colour }, lang, count, order)
  const ownSets = useReadyCatalog(lang)?.setsById
  const englishSets = useReadyCatalog('en')?.setsById
  // only the themes that have a name here are offered
  const themes = (ids ?? []).filter((id) => themeNames[id] !== undefined)
  const chosen = themeId !== undefined || colour !== undefined

  return (
    <>
      <p className="text-sm text-muted">{de.themes.hint}</p>
      {ids === null && (
        <p role="alert" className="mt-4 text-sm text-muted">
          {de.themes.error}
        </p>
      )}
      <div className="mt-4 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-3">
        <select
          aria-label={de.themes.pick}
          value={themeId ?? ''}
          onChange={(event) => {
            setThemeId(event.target.value === '' ? undefined : event.target.value)
            // another choice starts with its best cards again
            setCount(THEME_STEP)
          }}
          className={selectClass}
        >
          <option value="">{ids === undefined ? de.themes.loading : de.themes.all}</option>
          {themes.map((id) => (
            <option key={id} value={id}>
              {themeNames[id]}
            </option>
          ))}
        </select>
        <select
          aria-label={de.themes.colour}
          value={colour ?? ''}
          onChange={(event) => {
            setColour(PICTURE_COLOURS.find((option) => option === event.target.value))
            setCount(THEME_STEP)
          }}
          className={selectClass}
        >
          <option value="">{de.themes.allColours}</option>
          {PICTURE_COLOURS.map((option) => (
            <option key={option} value={option}>
              {de.themes.colours[option]}
            </option>
          ))}
        </select>
        <select
          aria-label={de.themes.order}
          value={order}
          onChange={(event) => setOrder(event.target.value === 'colour' ? 'colour' : 'fit')}
          className={`${selectClass} max-md:col-span-2`}
        >
          {ORDERS.map((option) => (
            <option key={option} value={option}>
              {de.themes.orders[option]}
            </option>
          ))}
        </select>
      </div>
      {!chosen && <p className="mt-5 text-sm text-muted">{de.themes.nothingChosen}</p>}
      {chosen && (
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
          {found.status === 'ready' && found.cards.length === 0 && <p className="text-sm text-muted">{de.themes.none}</p>}
          {found.status === 'ready' && found.cards.length > 0 && (
            <>
              <ul className={gridClass}>
                {found.cards.map(({ card, lang: cardLang }) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    set={(cardLang === lang ? ownSets : englishSets)?.get(setIdOfCard(card))}
                    lang={cardLang}
                    draggable={false}
                    dragIdPrefix={`theme:${themeId ?? ''}:${colour ?? ''}`}
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
