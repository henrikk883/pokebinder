import { useDraggable } from '@dnd-kit/core'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import type { DragSource } from '../binder/dragDrop'
import { CardImage } from './CardImage'

interface CardTileProps {
  card: CardSummary
  set: SetSummary | undefined
  /** Language the card was found in; it keeps it when placed in a binder. */
  lang: CardLang
  /** Cards can be dragged into a pocket while a binder is open. */
  draggable: boolean
}

export function CardTile({ card, set, lang, draggable }: CardTileProps) {
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId
  const source: DragSource = { kind: 'search', card, lang }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `search:${card.id}`,
    data: source,
    disabled: !draggable,
  })

  return (
    <li data-testid="card-tile" data-card-id={card.id} className="min-w-0">
      <div
        ref={setNodeRef}
        {...listeners}
        className={`${draggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
      >
        <CardImage card={card} set={set} size="small" />
      </div>
      <p className="mt-1.5 truncate text-sm font-medium" title={card.name}>
        {card.name}
      </p>
      <p className="truncate text-xs text-muted">
        {set ? `${set.name} · ${number}` : number}
      </p>
    </li>
  )
}
