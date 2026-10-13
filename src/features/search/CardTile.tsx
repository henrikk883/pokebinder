import { useDraggable } from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { de } from '../../i18n/de'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { CardLang } from '../../types/binder'
import type { DragSource } from '../binder/dragDrop'
import { placeByTap } from '../binder/placeCard'
import { useIsPhone } from '../../lib/phone'
import { CardImage } from './CardImage'
import { CardInfoDialog } from './CardInfoDialog'
import { listsWith, notedInOtherLangs, QUICK_LIST_ID } from './watchlist'

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
  /**
   * Where the cards are picked for something (a deck): a click on the card hands it over
   * instead of dragging it anywhere.
   */
  onPick?: (card: CardSummary, lang: CardLang) => void
  /** How often the card was picked already; shown on its picture. */
  picked?: number
  /** What a list adds below the card, e.g. its wish price. */
  footer?: ReactNode
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

export function CardTile({
  card,
  set,
  lang,
  draggable,
  dragIdPrefix = 'search',
  browsing = false,
  onPick,
  picked = 0,
  footer,
}: CardTileProps) {
  const [showingInfo, setShowingInfo] = useState(false)
  // the star notes into the quick list; the info window offers the others
  const listCount = useWatchlistStore((state) => listsWith(state.lists, card.id, lang).length)
  const saved = useWatchlistStore((state) => listsWith(state.lists, card.id, lang).includes(QUICK_LIST_ID))
  const toggleSaved = useWatchlistStore((state) => state.toggle)
  // a list notes a card in one language; in another the collector still has it in mind
  const otherLangs = useWatchlistStore((state) =>
    notedInOtherLangs(state.lists, card.id, lang)
      .map((noted) => noted.lang)
      .join(','),
  )
  const notedElsewhere = listCount === 0 && otherLangs !== ''
  const onOtherList = !saved && (listCount > 0 || notedElsewhere)
  const elsewhereHint = notedElsewhere
    ? de.watchlist.inOtherLang((otherLangs.split(',') as CardLang[]).map((other) => de.languages[other]))
    : undefined
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId
  const source: DragSource = { kind: 'search', card, lang }
  // Where nothing can be dragged across (a phone), a tap does what a drop does elsewhere.
  const tappable = useIsPhone() && draggable && !browsing
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
      ) : onPick ? (
        <button
          type="button"
          aria-label={de.decks.add(card.name)}
          onClick={() => onPick(card, lang)}
          className="relative block w-full rounded-pocket transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CardImage card={card} set={set} size="small" />
          {picked > 0 && (
            <span
              data-testid="picked-count"
              className="absolute right-1 bottom-1 rounded-control bg-accent px-2 py-0.5 text-sm font-semibold text-white"
            >
              {de.decks.copies(picked)}
            </span>
          )}
        </button>
      ) : (
        <div
          ref={setNodeRef}
          {...(tappable ? undefined : listeners)}
          {...(tappable
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': de.tap.place(card.name),
                onClick: () => void placeByTap(card, lang),
              }
            : undefined)}
          className={`${draggable && !tappable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
        >
          <CardImage card={card} set={set} size="small" />
        </div>
      )}
      {/* beside the picture, not in it: pressing these must not pick the card up */}
      <button
        type="button"
        aria-label={saved ? de.watchlist.unsaveCard(card.name) : de.watchlist.saveCard(card.name)}
        aria-pressed={saved}
        title={elsewhereHint ?? (onOtherList ? de.watchlist.onOtherList : undefined)}
        data-on-list={listCount > 0}
        data-other-lang={notedElsewhere ? otherLangs : undefined}
        onClick={() => toggleSaved(QUICK_LIST_ID, card.id, lang)}
        // A noted card keeps its star in view; that is how the lists show what is noted.
        // Filled: on the quick list. Outlined in colour: on another list only.
        className={`${overlayButtonClass} left-1 ${
          saved || onOtherList ? 'border-accent text-accent-hover' : 'border-line opacity-0 group-hover:opacity-100'
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
      {footer}
      {showingInfo && (
        <CardInfoDialog card={card} set={set} lang={lang} onClose={() => setShowingInfo(false)} />
      )}
    </li>
  )
}
