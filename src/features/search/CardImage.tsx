import { useState } from 'react'
import { de } from '../../i18n/de'
import {
  cardImageUrl,
  englishCardImage,
  type CardImageSize,
  type CardSummary,
  type SetSummary,
} from '../../lib/tcgdex'

interface CardImageProps {
  card: CardSummary
  set: SetSummary | undefined
  size: CardImageSize
}

const frameClass = 'aspect-[63/88] w-full rounded-pocket'

/**
 * Picture of a card. Without a scan in the card's language the English scan is shown in
 * black and white; without that, a grey placeholder with the card's name.
 */
export function CardImage({ card, set, size }: CardImageProps) {
  const [substituteFailed, setSubstituteFailed] = useState(false)

  if (card.image) {
    return (
      <img
        src={cardImageUrl(card.image, size)}
        alt={card.name}
        loading="lazy"
        decoding="async"
        className={`${frameClass} bg-raised object-cover`}
      />
    )
  }

  if (set && !substituteFailed) {
    return (
      <img
        src={cardImageUrl(englishCardImage(card, set), size)}
        alt={de.search.substituteImage(card.name)}
        title={de.search.substituteHint}
        loading="lazy"
        decoding="async"
        onError={() => setSubstituteFailed(true)}
        className={`${frameClass} bg-raised object-cover grayscale`}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={de.search.noImage(card.name)}
      className={`${frameClass} flex flex-col items-center justify-center gap-2 border border-line bg-linear-to-b from-neutral-700 to-neutral-900 p-2 text-center grayscale`}
    >
      <svg viewBox="0 0 24 24" className="size-8 text-neutral-400" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12h6m6 0h6" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="line-clamp-3 text-xs font-medium text-neutral-200">{card.name}</span>
    </div>
  )
}
