import { useState } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { CardLang } from '../../types/binder'
import { FilterSelect } from './FilterSelect'
import { LanguageSelect } from './LanguageSelect'
import { SearchResults } from './SearchResults'
import { SetPicker } from './SetPicker'
import { useCardSearchForm } from './useCardSearchForm'
import { WatchlistPanel } from './WatchlistPanel'

/** As many cards side by side as fit, each about as wide as a real card in the hand. */
const WIDE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-4 gap-y-6'

/**
 * The search of one language over the whole page. Names, sets, rarities and types differ
 * between languages, so it starts afresh when the language changes (see the `key` below).
 */
function WideSearch({ lang }: { lang: CardLang }) {
  const form = useCardSearchForm(lang)
  const setSearchLang = useEditorStore((state) => state.setSearchLang)

  return (
    <>
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <input
          type="search"
          value={form.text}
          onChange={(event) => form.setText(event.target.value)}
          placeholder={de.search.placeholder}
          aria-label={de.search.placeholder}
          className="h-10 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
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
        <FilterSelect label={de.search.rarity} value={form.rarity} options={form.rarities} onChange={form.setRarity} />
        <FilterSelect label={de.search.type} value={form.type} options={form.types} onChange={form.setType} />
        <LanguageSelect label={de.search.language} value={lang} onChange={setSearchLang} />
      </div>
      <div className="mt-5" data-testid="browse-results">
        <SearchResults
          search={form.search}
          sets={form.sets}
          selectedSet={form.selectedSet}
          lang={lang}
          draggable={false}
          gridClass={WIDE_GRID}
          dragIdPrefix="browse"
          browsing
        />
      </div>
    </>
  )
}

type Tab = 'all' | 'saved'
const tabClass = 'border-b-2 px-4 pb-2 text-sm font-medium whitespace-nowrap'

/**
 * The page "Karten": the card search over the whole width, to look through many cards in
 * large and note the ones worth having. Cards go into a binder from the search beside it.
 */
export function CardBrowser() {
  const [tab, setTab] = useState<Tab>('all')
  const searchLang = useEditorStore((state) => state.searchLang)
  const savedCount = useWatchlistStore((state) => state.cards.length)

  return (
    <section className="mx-auto flex min-h-full max-w-[110rem] flex-col p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="text-2xl font-semibold">{de.browse.title}</h2>
        <div role="tablist" aria-label={de.browse.title} className="flex border-b border-line">
          {(['all', 'saved'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={`${tabClass} ${
                tab === option ? 'border-accent text-accent-hover' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {de.browse.tabs[option]}
              {option === 'saved' && savedCount > 0 && <span className="ml-1 text-xs text-muted">{savedCount}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{de.browse.hint}</p>

      {/* both stay mounted, so the search keeps its results while the list is shown */}
      <div className={tab === 'all' ? 'mt-5' : 'hidden'}>
        <WideSearch key={searchLang} lang={searchLang} />
      </div>
      <div className={tab === 'saved' ? 'mt-5' : 'hidden'}>
        <WatchlistPanel wide gridClass={WIDE_GRID} />
      </div>
    </section>
  )
}
