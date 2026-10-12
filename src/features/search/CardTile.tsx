import { useDraggable } from '@dnd-kit/core'
import { useState } from 'react'
import { de } from '../../i18n/de'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import type { DragSource } from '../binder/dragDrop'
import { CardImage } from './CardImage'
import { CardInfoDialog } from './CardInfoDialog'

interface CardTileProps {
  card: CardSummary
  set: SetSummary | undefined
  /** Language the card was found in; it keeps it when placed in a binder. */
  lang: CardLang
  /** Cards can be dragged into a pocket while a binder is open. */
  draggable: boolean
}

export function CardTile({ card, set, lang, draggable }: CardTileProps) {
  const [showingInfo, setShowingInfo] = useState(false)
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId
  const source: DragSource = { kind: 'search', card, lang }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `search:${card.id}`,
    data: source,
    disabled: !draggable,
  })

  return (
    <li data-testid="card-tile" data-card-id={card.id} className="group relative min-w-0">
      <div
        ref={setNodeRef}
        {...listeners}
        className={`${draggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
      >
        <CardImage card={card} set={set} size="small" />
      </div>
      {/* beside the picture, not in it: pressing it must not pick the card up */}
      <button
        type="button"
        aria-label={de.cardInfo.open(card.name)}
        onClick={() => setShowingInfo(true)}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full border border-line bg-bg/90 text-xs font-semibold opacity-0 group-hover:opacity-100 hover:border-accent focus-visible:opacity-100 touch:size-8 touch:text-sm touch:opacity-100"
      >
        <span aria-hidden="true">i</span>
      </button>
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
