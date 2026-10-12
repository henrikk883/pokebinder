import { useDraggable } from '@dnd-kit/core'
import { useState } from 'react'
import { de } from '../../i18n/de'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { CardLang } from '../../types/binder'
import type { DragSource } from '../binder/dragDrop'
import { CardImage } from './CardImage'
import { CardInfoDialog } from './CardInfoDialog'
import { isSaved } from './watchlist'

interface CardTileProps {
  card: CardSummary
  set: SetSummary | undefined
  /** Language the card was found in; it keeps it when placed in a binder. */
  lang: CardLang
  /** Cards can be dragged into a pocket while a binder is open. */
  draggable: boolean
  /** Tells the tiles of one list from those of another when both show the same card. */
  dragIdPrefix?: string
  /**
   * On the page "Karten" there is no binder to drag into: there a click on the card opens
   * its info, which beside the binder the info button does.
   */
  browsing?: boolean
}

// Buttons on the picture: under the mouse on the card pointed at, by finger always there.
const overlayButtonClass =
  'absolute top-1 flex size-6 items-center justify-center rounded-full border bg-bg/90 hover:border-accent focus-visible:opacity-100 touch:size-8 touch:opacity-100'

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 touch:size-4" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CardTile({ card, set, lang, draggable, dragIdPrefix = 'search', browsing = false }: CardTileProps) {
  const [showingInfo, setShowingInfo] = useState(false)
  const saved = useWatchlistStore((state) => isSaved(state.cards, card.id, lang))
  const toggleSaved = useWatchlistStore((state) => state.toggle)
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId
  const source: DragSource = { kind: 'search', card, lang }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `${dragIdPrefix}:${card.id}`,
    data: source,
    disabled: !draggable,
  })

  return (
    <li data-testid="card-tile" data-card-id={card.id} className="group relative min-w-0">
      {browsing ? (
        <button
          type="button"
          aria-label={de.cardInfo.open(card.name)}
          onClick={() => setShowingInfo(true)}
          className="block w-full rounded-pocket transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CardImage card={card} set={set} size="small" />
        </button>
      ) : (
        <div
          ref={setNodeRef}
          {...listeners}
          className={`${draggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
        >
          <CardImage card={card} set={set} size="small" />
        </div>
      )}
      {/* beside the picture, not in it: pressing these must not pick the card up */}
      <button
        type="button"
        aria-label={saved ? de.watchlist.unsaveCard(card.name) : de.watchlist.saveCard(card.name)}
        aria-pressed={saved}
        onClick={() => toggleSaved(card.id, lang)}
        // a noted card keeps its star in view; that is how the lists show what is noted
        className={`${overlayButtonClass} left-1 ${
          saved ? 'border-accent text-accent-hover' : 'border-line opacity-0 group-hover:opacity-100'
        }`}
      >
        <Star filled={saved} />
      </button>
      {!browsing && (
        <button
          type="button"
          aria-label={de.cardInfo.open(card.name)}
          onClick={() => setShowingInfo(true)}
          className={`${overlayButtonClass} right-1 border-line text-xs font-semibold opacity-0 group-hover:opacity-100 touch:text-sm`}
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
      <p className="mt-1.5 truncate text-sm font-medium" title={card.name}>
        {card.name}
      </p>
      <p className="truncate text-xs text-muted">
        {set ? `${set.name} · ${number}` : number}
      </p>
      {showingInfo && (
        <CardInfoDialog card={card} set={set} lang={lang} onClose={() => setShowingInfo(false)} />
      )}
    </li>
  )
}
