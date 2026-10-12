import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { useCard } from '../binder/useCard'
import { CardTile } from './CardTile'
import { useReadyCatalog } from './useCatalog'
import type { SavedCard } from './watchlist'

function SavedTile({ saved, draggable }: { saved: SavedCard; draggable: boolean }) {
  const card = useCard(saved.cardId, saved.lang)
  const catalog = useReadyCatalog(saved.lang)

  if (!card) {
    // still being looked up, or TCGdex does not know the card (any more)
    return (
      <li data-testid="saved-card" data-card-id={saved.cardId} className="min-w-0">
        <div className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-xs text-muted">
          {card === null ? de.binder.unknownCard : ''}
        </div>
        <p className="mt-1.5 truncate text-xs text-muted">{saved.cardId}</p>
      </li>
    )
  }
  return (
    <CardTile
      card={card}
      set={catalog?.setsById.get(setIdOfCard(card))}
      lang={saved.lang}
      draggable={draggable}
      // the same card may also be among the search results, which stay mounted
      dragIdPrefix="saved"
    />
  )
}

/** The "Merkliste": cards noted from the card info, ready to be dragged into a binder. */
export function WatchlistPanel() {
  const cards = useWatchlistStore((state) => state.cards)
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-testid="watchlist">
        {cards.length === 0 ? (
          <p className="text-sm text-muted">{de.watchlist.empty}</p>
        ) : (
          <>
            <p role="status" className="mb-3 text-xs text-muted">
              {de.watchlist.count(cards.length)}
            </p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
              {cards.map((saved) => (
                <SavedTile key={`${saved.lang}:${saved.cardId}`} saved={saved} draggable={binderOpen} />
              ))}
            </ul>
          </>
        )}
      </div>
      {binderOpen && cards.length > 0 && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-muted">{de.search.dragHint}</p>
      )}
    </div>
  )
}
