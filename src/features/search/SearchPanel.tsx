import { useState } from 'react'
import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { CardLang } from '../../types/binder'
import { ImageLibrary } from '../images/ImageLibrary'
import { FilterSelect } from './FilterSelect'
import { LanguageSelect } from './LanguageSelect'
import { SearchResults } from './SearchResults'
import { SetPicker } from './SetPicker'
import { TapHint } from './TapHint'
import { useCardSearchForm } from './useCardSearchForm'
import { savedCardCount } from './watchlist'
import { useWishAlarms } from './wishPrice'
import { WatchlistPanel } from './WatchlistPanel'

const tabClass = 'border-b-2 px-2.5 pb-2 text-sm font-medium whitespace-nowrap'

/**
 * Search in the cards of one language. Names, sets, rarities and types all differ between
 * languages, so the search starts afresh when the language changes (see the `key` below).
 */
function CardSearch({ lang }: { lang: CardLang }) {
  const form = useCardSearchForm(lang)
  const setSearchLang = useEditorStore((state) => state.setSearchLang)

  // cards are dragged into a binder while arranging it, not while ticking off the collection
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-3">
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

        <div className="grid grid-cols-2 gap-2">
          <FilterSelect label={de.search.rarity} value={form.rarity} options={form.rarities} onChange={form.setRarity} />
          <FilterSelect label={de.search.type} value={form.type} options={form.types} onChange={form.setType} />
        </div>

        <LanguageSelect label={de.search.language} value={lang} onChange={setSearchLang} />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 max-md:flex-none max-md:overflow-visible"
        data-testid="search-results"
      >
        <SearchResults
          search={form.search}
          sets={form.sets}
          selectedSet={form.selectedSet}
          lang={lang}
          draggable={binderOpen}
          gridClass="grid grid-cols-2 gap-x-3 gap-y-4"
          dragIdPrefix="search"
        />
      </div>

      {binderOpen && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-muted max-md:hidden">
          {de.search.dragHint}
        </p>
      )}
      {binderOpen && <TapHint />}
    </div>
  )
}

type Tab = 'cards' | 'images' | 'saved'

/** Left column: card search, the library of uploaded images, and the cards noted for later. */
export function SearchPanel() {
  const [tab, setTab] = useState<Tab>('cards')
  const searchLang = useEditorStore((state) => state.searchLang)
  const savedCount = useWatchlistStore((state) => savedCardCount(state.lists))
  const alarms = useWishAlarms(useWatchlistStore((state) => state.lists))

  return (
    <section className="flex h-full flex-col max-md:h-auto">
      <div className="shrink-0 space-y-3 p-4 pb-3">
        <h2 className="text-lg font-semibold">{de.search.title}</h2>
        <div role="tablist" className="flex border-b border-line">
          {(['cards', 'images', 'saved'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={`${tabClass} ${
                tab === option
                  ? 'border-accent text-accent-hover'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {de.search.tabs[option]}
              {option === 'saved' && savedCount > 0 && (
                <span data-testid="saved-count" className="ml-1 text-xs text-muted">
                  {savedCount}
                </span>
              )}
              {option === 'saved' && alarms > 0 && (
                <span data-testid="wish-alarms" title={de.wish.alarms(alarms)} className="ml-1 rounded-full border border-accent px-1.5 text-xs text-text">
                  {alarms}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* all stay mounted, so the search keeps its results while another tab is shown */}
      <div className={tab === 'cards' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <CardSearch key={searchLang} lang={searchLang} />
      </div>
      <div className={tab === 'images' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <ImageLibrary />
      </div>
      <div className={tab === 'saved' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <WatchlistPanel />
      </div>
    </section>
  )
}
