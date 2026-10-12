import { de } from '../../i18n/de'
import { setIdOfCard, type CardSummary, type SetSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { CardTile } from './CardTile'
import type { useCardSearch } from './useCardSearch'

interface SearchResultsProps {
  search: ReturnType<typeof useCardSearch>
  sets: ReadonlyMap<string, SetSummary> | undefined
  selectedSet: SetSummary | undefined
  lang: CardLang
  /** Cards can be dragged into a pocket while a binder is open beside the results. */
  draggable: boolean
  /** How the cards are laid out: two beside the binder, as many as fit on the page "Karten". */
  gridClass: string
  /** Tells these tiles from those of another list that shows the same cards. */
  dragIdPrefix: string
  /** On the page "Karten" a click on a card opens its info; beside the binder cards are dragged. */
  browsing?: boolean
  /** Where cards are picked at a click (for a deck), and how often each was picked already. */
  onPick?: (card: CardSummary, lang: CardLang) => void
  countOf?: (cardId: string, lang: CardLang) => number
}

/** What a card search found, or why there is nothing to show. */
export function SearchResults({
  search,
  sets,
  selectedSet,
  lang,
  draggable,
  gridClass,
  dragIdPrefix,
  browsing = false,
  onPick,
  countOf,
}: SearchResultsProps) {
  return (
    <>
      {search.status === 'idle' && <p className="text-sm text-muted">{de.search.idle}</p>}
      {search.status === 'needsContext' && <p className="text-sm text-muted">{de.search.needsContext}</p>}
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
          <ul className={gridClass}>
            {search.cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                set={sets?.get(setIdOfCard(card))}
                lang={lang}
                draggable={draggable}
                dragIdPrefix={dragIdPrefix}
                browsing={browsing}
                {...(onPick ? { onPick, picked: countOf?.(card.id, lang) ?? 0 } : {})}
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
    </>
  )
}
