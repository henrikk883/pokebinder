import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard, tcgdex } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { ImageLibrary } from '../images/ImageLibrary'
import { CardTile } from './CardTile'
import { FilterSelect } from './FilterSelect'
import { SetPicker } from './SetPicker'
import { useCardSearch } from './useCardSearch'
import { useCatalog } from './useCatalog'
import { useDebouncedValue } from './useDebouncedValue'
import { useLoaded } from './useLoaded'

/** Results follow the typing after this pause. */
const SEARCH_DELAY_MS = 300

const loadRarities = () => tcgdex.getRarities()
const loadTypes = () => tcgdex.getTypes()

const tabClass = 'border-b-2 px-4 pb-2 text-sm font-medium'

function GermanFlag() {
  return (
    <span aria-hidden="true" className="flex size-5 shrink-0 flex-col overflow-hidden rounded-full">
      <span className="flex-1 bg-black" />
      <span className="flex-1 bg-[#dd0000]" />
      <span className="flex-1 bg-[#ffce00]" />
    </span>
  )
}

function CardSearch() {
  const [text, setText] = useState('')
  const [setId, setSetId] = useState<string>()
  const [rarity, setRarity] = useState<string>()
  const [type, setType] = useState<string>()

  const binderOpen = useBinderStore((state) => state.binder !== null)
  const catalog = useCatalog()
  const rarities = useLoaded(loadRarities)
  const types = useLoaded(loadTypes)
  const search = useCardSearch(useDebouncedValue(text, SEARCH_DELAY_MS), setId, rarity, type)

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

        <div
          title={de.search.languageHint}
          className="flex h-10 items-center gap-3 rounded-control border border-line bg-raised px-3 text-sm text-muted"
        >
          <GermanFlag />
          <span>{de.search.language}</span>
        </div>
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

type Tab = 'cards' | 'images'

/** Left column: card search and the library of uploaded images. */
export function SearchPanel() {
  const [tab, setTab] = useState<Tab>('cards')

  return (
    <section className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 p-4 pb-3">
        <h2 className="text-lg font-semibold">{de.search.title}</h2>
        <div role="tablist" className="flex border-b border-line">
          {(['cards', 'images'] as const).map((option) => (
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
            </button>
          ))}
        </div>
      </div>

      {/* both stay mounted, so the search keeps its results while images are shown */}
      <div className={tab === 'cards' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <CardSearch />
      </div>
      <div className={tab === 'images' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <ImageLibrary />
      </div>
    </section>
  )
}
