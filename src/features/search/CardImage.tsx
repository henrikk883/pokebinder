import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import {
  cardImageSources,
  imageExists,
  scanMemory,
  type CardImageSize,
  type CardSummary,
  type SetSummary,
  type SubstituteImage,
} from '../../lib/tcgdex'

interface CardImageProps {
  card: CardSummary
  set: SetSummary | undefined
  size: CardImageSize
  /** Cards the collector does not own yet are shown in black and white. */
  missing?: boolean
}

const frameClass = 'aspect-[63/88] w-full rounded-pocket'

// Large stand-in pictures that have arrived: shown at once wherever the card comes up again.
const arrived = new Set<string>()

/**
 * Fetches the large version of a stand-in picture behind the scenes; says when it is there.
 * The pictures of the second image source are several hundred kilobytes each: a page of
 * them must not stay empty until all have arrived.
 */
function useLargeArrived(large: SubstituteImage | undefined, wanted: boolean): boolean {
  const [, setCount] = useState(0)
  const url = large?.url
  const mustVerify = large?.mustVerify ?? false

  useEffect(() => {
    if (!wanted || url === undefined || arrived.has(url)) return
    let cancelled = false
    const done = (there: boolean) => {
      if (there) arrived.add(url)
      if (there && !cancelled) setCount((count) => count + 1)
    }
    if (mustVerify) {
      void imageExists(url).then(done)
    } else {
      const image = new Image()
      image.onload = () => done(true)
      image.src = url
    }
    return () => {
      cancelled = true
    }
  }, [url, mustVerify, wanted])

  return url !== undefined && arrived.has(url)
}

/**
 * Picture of a card. Without a scan in the card's language an English scan stands in,
 * from TCGdex or from the second image source; without any, a grey placeholder with the
 * card's name.
 */
export function CardImage({ card, set, size, missing = false }: CardImageProps) {
  // What failed is remembered per address, here for this card and in `scanMemory` for good:
  // the same pocket shows other cards after a page turn or a drop, and a card whose English
  // scan is missing must not be asked for again each time it comes up.
  const [failed, setFailed] = useState<readonly string[]>([])
  const [confirmed, setConfirmed] = useState<readonly string[]>([])
  const tone = missing ? 'grayscale' : ''
  // The long search lists load their small pictures as they scroll into view. Binder pages
  // load theirs at once, so that a page is complete when it is exported.
  const loading = size === 'small' ? 'lazy' : 'eager'
  const { own, substitutes: wanted } = cardImageSources(card, set, size)
  // A stand-in is shown small first, also in the binder: the small one is there quickly.
  const small = own ? [] : cardImageSources(card, set, 'small').substitutes
  const index = small.findIndex((candidate) => !failed.includes(candidate.url) && !scanMemory.isMissing(candidate.url))
  const substitute = index < 0 ? undefined : small[index]
  const unchecked =
    substitute?.mustVerify && !confirmed.includes(substitute.url) ? substitute.url : undefined
  const large = size === 'large' && index >= 0 ? wanted[index] : undefined
  const largeArrived = useLargeArrived(large, substitute !== undefined && unchecked === undefined)

  // A source that answers "not found" with a picture has to be asked before it is shown.
  useEffect(() => {
    if (unchecked === undefined) return
    let cancelled = false
    imageExists(unchecked).then((exists) => {
      if (cancelled) return
      if (exists) setConfirmed((known) => [...known, unchecked])
      else {
        scanMemory.noteMissing(unchecked)
        setFailed((known) => [...known, unchecked])
      }
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
    const shown = large && largeArrived ? large.url : substitute.url
    return (
      <img
        // a fresh element per card, so a failed load never sticks to the next one
        key={substitute.url}
        src={shown}
        alt={de.search.substituteImage(card.name)}
        title={de.search.substituteHint}
        loading={loading}
        decoding="async"
        draggable={false}
        onLoad={() => scanMemory.noteFound(shown)}
        onError={() => {
          scanMemory.noteMissing(substitute.url)
          setFailed((known) => [...known, substitute.url])
        }}
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
