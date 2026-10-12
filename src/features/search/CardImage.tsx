import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import {
  cardImageSources,
  imageExists,
  type CardImageSize,
  type CardSummary,
  type SetSummary,
} from '../../lib/tcgdex'

interface CardImageProps {
  card: CardSummary
  set: SetSummary | undefined
  size: CardImageSize
  /** Cards the collector does not own yet are shown in black and white. */
  missing?: boolean
}

const frameClass = 'aspect-[63/88] w-full rounded-pocket'

/**
 * Picture of a card. Without a scan in the card's language an English scan stands in,
 * from TCGdex or from the second image source; without any, a grey placeholder with the
 * card's name.
 */
export function CardImage({ card, set, size, missing = false }: CardImageProps) {
  // Remembered per image address, not as a plain flag: the same pocket shows other cards
  // after a page turn or a drop, and one card without an English scan must not hide the
  // English scan of the next.
  const [failed, setFailed] = useState<readonly string[]>([])
  const [confirmed, setConfirmed] = useState<readonly string[]>([])
  const tone = missing ? 'grayscale' : ''
  // The long search lists load their small pictures as they scroll into view. Binder pages
  // load theirs at once, so that a page is complete when it is exported.
  const loading = size === 'small' ? 'lazy' : 'eager'
  const { own, substitutes } = cardImageSources(card, set, size)
  const substitute = own ? undefined : substitutes.find((candidate) => !failed.includes(candidate.url))
  const unchecked =
    substitute?.mustVerify && !confirmed.includes(substitute.url) ? substitute.url : undefined

  // A source that answers "not found" with a picture has to be asked before it is shown.
  useEffect(() => {
    if (unchecked === undefined) return
    let cancelled = false
    imageExists(unchecked).then((exists) => {
      if (cancelled) return
      if (exists) setConfirmed((known) => [...known, unchecked])
      else setFailed((known) => [...known, unchecked])
    })
    return () => {
      cancelled = true
    }
  }, [unchecked])

  if (own) {
    return (
      <img
        key={own}
        // Plainly shown, not asked for in a readable form: TCGdex answers such requests
        // unusably every so often, which left pockets empty. What needs to read a picture
        // (PNG export, PDFs) fetches it itself, see `readPicture`.
        src={own}
        alt={card.name}
        loading={loading}
        decoding="async"
        draggable={false}
        className={`${frameClass} bg-raised object-cover ${tone}`}
      />
    )
  }

  if (unchecked !== undefined) {
    // still asking whether the stand-in exists; an export of the page waits for the answer
    return <div data-pending="" className={`${frameClass} bg-raised`} />
  }

  if (substitute !== undefined) {
    return (
      <img
        // a fresh element per address, so a failed load never sticks to the next one
        key={substitute.url}
        src={substitute.url}
        alt={de.search.substituteImage(card.name)}
        title={de.search.substituteHint}
        loading={loading}
        decoding="async"
        draggable={false}
        onError={() => setFailed((known) => [...known, substitute.url])}
        className={`${frameClass} bg-raised object-cover ${tone}`}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={de.search.noImage(card.name)}
      className={`${frameClass} flex flex-col items-center justify-center gap-2 border border-line bg-linear-to-b from-neutral-700 to-neutral-900 p-2 text-center`}
    >
      <svg viewBox="0 0 24 24" className="size-1/3 max-w-8 text-neutral-400" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12h6m6 0h6" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="line-clamp-3 text-xs font-medium text-neutral-200">{card.name}</span>
    </div>
  )
}
