import { de } from '../../i18n/de'
import { useAssetUrl } from '../../store/assetStore'
import type { Deck } from '../../types/deck'
import { DECK_SIZE, deckSize } from './deckModel'

/**
 * A deck as it stands on the shelf: a flat deck box with its lid, carrying the picture
 * chosen for it or, without one, its name. Below the lid it says how full the deck is.
 */
export function DeckBox({ deck }: { deck: Deck }) {
  const imageUrl = useAssetUrl(deck.coverAssetId)

  return (
    <span
      data-testid="deck-box"
      className="relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-panel border border-line bg-raised shadow-lg transition-transform group-hover:-translate-y-1"
    >
      {/* the lid, with the notch one opens it by */}
      <span className="relative h-[17%] shrink-0 border-b border-line bg-panel">
        <span className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 rounded-t-full border border-b-0 border-line bg-raised" />
      </span>
      <span className="relative flex min-h-0 flex-1 items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            data-testid="deck-box-image"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="line-clamp-4 px-3 text-center text-base font-semibold text-muted">{deck.name}</span>
        )}
        <span className="absolute right-2 bottom-2 rounded-control bg-bg/90 px-1.5 py-0.5 text-[0.65rem] font-semibold">
          {de.decks.size(deckSize(deck), DECK_SIZE)}
        </span>
      </span>
    </span>
  )
}
