import { de } from '../../i18n/de'
import { cardImageUrl, type CardSummary, type SetSummary } from '../../lib/tcgdex'

interface CardTileProps {
  card: CardSummary
  set: SetSummary | undefined
}

export function CardTile({ card, set }: CardTileProps) {
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId

  return (
    <li data-testid="card-tile" data-card-id={card.id} className="min-w-0">
      {card.image ? (
        <img
          src={cardImageUrl(card.image, 'small')}
          alt={card.name}
          loading="lazy"
          decoding="async"
          className="aspect-[63/88] w-full rounded-pocket bg-raised object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={de.search.noImage(card.name)}
          className="flex aspect-[63/88] w-full flex-col items-center justify-center gap-2 rounded-pocket border border-line bg-linear-to-b from-neutral-700 to-neutral-900 p-2 text-center grayscale"
        >
          <svg viewBox="0 0 24 24" className="size-8 text-neutral-400" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 12h6m6 0h6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="line-clamp-3 text-xs font-medium text-neutral-200">{card.name}</span>
        </div>
      )}
      <p className="mt-1.5 truncate text-sm font-medium" title={card.name}>
        {card.name}
      </p>
      <p className="truncate text-xs text-muted">
        {set ? `${set.name} · ${number}` : number}
      </p>
    </li>
  )
}
