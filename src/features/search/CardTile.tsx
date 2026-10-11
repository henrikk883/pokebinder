import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { CardImage } from './CardImage'

interface CardTileProps {
  card: CardSummary
  set: SetSummary | undefined
}

export function CardTile({ card, set }: CardTileProps) {
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId

  return (
    <li data-testid="card-tile" data-card-id={card.id} className="min-w-0">
      <CardImage card={card} set={set} size="small" />
      <p className="mt-1.5 truncate text-sm font-medium" title={card.name}>
        {card.name}
      </p>
      <p className="truncate text-xs text-muted">
        {set ? `${set.name} · ${number}` : number}
      </p>
    </li>
  )
}
