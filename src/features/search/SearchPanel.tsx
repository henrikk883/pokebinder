import { useMemo, useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard, tcgdexFor } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { CardLang } from '../../types/binder'
import { ImageLibrary } from '../images/ImageLibrary'
import { CardTile } from './CardTile'
import { FilterSelect } from './FilterSelect'
import { LanguageSelect } from './LanguageSelect'
import { SetPicker } from './SetPicker'
import { useCardSearch } from './useCardSearch'
import { useCatalog } from './useCatalog'
import { useDebouncedValue } from './useDebouncedValue'
import { useLoaded } from './useLoaded'
import { WatchlistPanel } from './WatchlistPanel'
import { useWatchlistStore } from '../../store/watchlistStore'

/** Results follow the typing after this pause. */
const SEARCH_DELAY_MS = 300

const tabClass = 'border-b-2 px-2.5 pb-2 text-sm font-medium whitespace-nowrap'

/**
 * Search in the cards of one language. Names, sets, rarities and types all differ between
 * languages, so the search starts afresh when the language changes (see the `key` below).
 */
function CardSearch({ lang }: { lang: CardLang }) {
  const [text, setText] = useState('')
  const [setId, setSetId] = useState<string>()
  const [rarity, setRarity] = useState<string>()
  const [type, setType] = useState<string>()
  const setSearchLang = useEditorStore((state) => state.setSearchLang)

  // cards are dragged into a binder while arranging it, not while ticking off the collection
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing
  const catalog = useCatalog(lang)
  const loaders = useMemo(
    () => ({
      rarities: () => tcgdexFor(lang).getRarities(),
      types: () => tcgdexFor(lang).getTypes(),
    }),
    [lang],
  )
  const rarities = useLoaded(loaders.rarities)
  const types = useLoaded(loaders.types)
  const search = useCardSearch(lang, useDebouncedValue(text, SEARCH_DELAY_MS), setId, rarity, type)

  const sets = catalog.status === 'ready' ? catalog.data.setsById : undefined
  const selectedSet = setId ? sets?.get(setId) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-3">
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={de.search.placeholder}
          aria-label={de.search.placeholder}
          className="h-10 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />

        <SetPicker
          catalog={catalog.status === 'ready' ? catalog.data : undefined}
          unavailableText={
            catalog.status === 'ready'
              ? undefined
              : catalog.status === 'loading'
                ? de.search.setsLoading
                : de.search.setsError
          }
          value={setId}
          onChange={setSetId}
        />

        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label={de.search.rarity}
            value={rarity}
            options={rarities.status === 'ready' ? rarities.data : []}
            onChange={setRarity}
          />
          <FilterSelect
            label={de.search.type}
            value={type}
            options={types.status === 'ready' ? types.data : []}
            onChange={setType}
          />
        </div>

        <LanguageSelect label={de.search.language} value={lang} onChange={setSearchLang} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-testid="search-results">
        {search.status === 'idle' && <p className="text-sm text-muted">{de.search.idle}</p>}
        {search.status === 'needsContext' && (
          <p className="text-sm text-muted">{de.search.needsContext}</p>
        )}
        {search.status === 'loading' && (
          <p role="status" className="text-sm text-muted">
            {de.search.loading}
          </p>
        )}
        {search.status === 'error' && (
          <p role="alert" className="text-sm text-muted">
            {de.search.error}
          </p>
        )}
        {search.status === 'ready' && (
          <>
            <p role="status" className="mb-3 text-xs text-muted">
              {search.cards.length === 0
                ? de.search.noResults
                : de.search.resultCount(search.cards.length, search.hasMore, selectedSet?.name)}
            </p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
              {search.cards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  set={sets?.get(setIdOfCard(card))}
                  lang={lang}
                  draggable={binderOpen}
                />
              ))}
            </ul>
            {search.hasMore && (
              <button
                type="button"
                onClick={search.loadMore}
                className="mt-4 h-10 w-full rounded-control border border-line bg-raised text-sm hover:border-accent"
              >
                {de.search.more}
              </button>
            )}
            {search.loadingMore && (
              <p role="status" className="mt-4 text-center text-sm text-muted">
                {de.search.loading}
              </p>
            )}
          </>
        )}
      </div>

      {binderOpen && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-muted">
          {de.search.dragHint}
        </p>
      )}
    </div>
  )
}

type Tab = 'cards' | 'images' | 'saved'

/** Left column: card search, the library of uploaded images, and the cards noted for later. */
export function SearchPanel() {
  const [tab, setTab] = useState<Tab>('cards')
  const searchLang = useEditorStore((state) => state.searchLang)
  const savedCount = useWatchlistStore((state) => state.cards.length)

  return (
    <section className="flex h-full flex-col">
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
