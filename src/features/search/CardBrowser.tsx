import { useState } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { CardSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { FilterSelect } from './FilterSelect'
import { IllustratorInput } from './IllustratorInput'
import { LanguageSelect } from './LanguageSelect'
import { SearchResults } from './SearchResults'
import { SetPicker } from './SetPicker'
import { useCardSearchForm } from './useCardSearchForm'
import { savedCardCount } from './watchlist'
import { WatchlistPanel } from './WatchlistPanel'
import { useWishAlarms } from './wishPrice'
import { ThemeBrowser } from '../similar/ThemeBrowser'

/** As many cards side by side as fit, each about as wide as a real card in the hand. */
const WIDE_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-4 gap-y-6 max-md:grid-cols-2 max-md:gap-x-3'

/**
 * The search of one language over the whole page. Names, sets, rarities and types differ
 * between languages, so it starts afresh when the language changes (see the `key` below).
 */
interface WideSearchProps {
  lang: CardLang
  /** Tells the tiles of this search from those of another that is mounted as well. */
  dragIdPrefix?: string
  /** For a deck: a click on a card picks it, and its picture says how often it was picked. */
  onPick?: (card: CardSummary, lang: CardLang) => void
  countOf?: (cardId: string, lang: CardLang) => number
}

export function WideSearch({ lang, dragIdPrefix = 'browse', onPick, countOf }: WideSearchProps) {
  const form = useCardSearchForm(lang)
  const setSearchLang = useEditorStore((state) => state.setSearchLang)

  return (
    <>
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-6">
        <input
          type="search"
          value={form.text}
          onChange={(event) => form.setText(event.target.value)}
          placeholder={de.search.placeholder}
          aria-label={de.search.placeholder}
          className="col-span-2 h-10 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none lg:col-span-3"
        />
        {/* the list of sets needs the whole width where the filters stand in two columns */}
        <div className="col-span-2 lg:col-span-3">
        <SetPicker
          catalog={form.catalog.status === 'ready' ? form.catalog.data : undefined}
          unavailableText={
            form.catalog.status === 'ready'
              ? undefined
              : form.catalog.status === 'loading'
                ? de.search.setsLoading
                : de.search.setsError
          }
          value={form.setId}
          onChange={form.setSetId}
        />
        </div>
        <FilterSelect label={de.search.rarity} value={form.rarity} options={form.rarities} onChange={form.setRarity} />
        <FilterSelect label={de.search.type} value={form.type} options={form.types} onChange={form.setType} />
        <FilterSelect label={de.search.category} value={form.category} options={form.categories} onChange={form.setCategory} />
        <div className="lg:col-span-2">
          <IllustratorInput
            label={de.search.illustrator}
            value={form.illustrator}
            options={form.illustrators}
            onChange={form.setIllustrator}
          />
        </div>
        <LanguageSelect label={de.search.language} value={lang} onChange={setSearchLang} />
      </div>
      <div className="mt-5" data-testid={onPick ? 'pick-results' : 'browse-results'}>
        <SearchResults
          search={form.search}
          sets={form.sets}
          selectedSet={form.selectedSet}
          lang={lang}
          draggable={false}
          gridClass={WIDE_GRID}
          dragIdPrefix={dragIdPrefix}
          browsing={!onPick}
          {...(onPick ? { onPick } : {})}
          {...(countOf ? { countOf } : {})}
        />
      </div>
    </>
  )
}

type Tab = 'all' | 'themes' | 'saved'
const tabClass = 'border-b-2 px-4 pb-2 text-sm font-medium whitespace-nowrap'

/**
 * The page "Karten": the card search over the whole width, to look through many cards in
 * large and note the ones worth having. Cards go into a binder from the search beside it.
 */
export function CardBrowser() {
  const [tab, setTab] = useState<Tab>('all')
  // the themes bring a file of their own along, which is only loaded once they are looked at
  const [themesOpened, setThemesOpened] = useState(false)
  const searchLang = useEditorStore((state) => state.searchLang)
  const savedCount = useWatchlistStore((state) => savedCardCount(state.lists))
  const alarms = useWishAlarms(useWatchlistStore((state) => state.lists))

  return (
    <section className="mx-auto flex min-h-full max-w-[110rem] flex-col p-5 max-md:p-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="text-2xl font-semibold">{de.browse.title}</h2>
        <div role="tablist" aria-label={de.browse.title} className="flex border-b border-line">
          {(['all', 'themes', 'saved'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => {
                setTab(option)
                if (option === 'themes') setThemesOpened(true)
              }}
              className={`${tabClass} ${
                tab === option ? 'border-accent text-accent-hover' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {de.browse.tabs[option]}
              {option === 'saved' && savedCount > 0 && <span className="ml-1 text-xs text-muted">{savedCount}</span>}
              {option === 'saved' && alarms > 0 && (
                <span title={de.wish.alarms(alarms)} className="ml-1 rounded-full border border-accent px-1.5 text-xs text-text">
                  {alarms}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{de.browse.hint}</p>

      {/* both stay mounted, so the search keeps its results while the list is shown */}
      <div className={tab === 'all' ? 'mt-5' : 'hidden'}>
        <WideSearch key={searchLang} lang={searchLang} />
      </div>
      <div className={tab === 'themes' ? 'mt-5' : 'hidden'}>
        {themesOpened && <ThemeBrowser lang={searchLang} gridClass={WIDE_GRID} />}
      </div>
      <div className={tab === 'saved' ? 'mt-5' : 'hidden'}>
        <WatchlistPanel wide gridClass={WIDE_GRID} />
      </div>
    </section>
  )
}
