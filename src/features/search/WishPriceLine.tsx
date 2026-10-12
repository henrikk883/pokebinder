import { de } from '../../i18n/de'
import { promptDialog } from '../../store/dialogStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import type { SavedCard } from './watchlist'
import { isBelowWish, parseAmount, useCurrentPrice } from './wishPrice'

/**
 * Under a card of a "Merkliste": the price the collector would pay for it, if one is set,
 * and a word as soon as the card can be had for that or less. Looked at when the app is
 * open; nothing is sent to the device from outside.
 */
export function WishPrice({ listId, saved, name }: { listId: string; saved: SavedCard; name: string }) {
  const setWishPrice = useWatchlistStore((state) => state.setWishPrice)
  const price = useCurrentPrice(saved.cardId, saved.lang, saved.wishPrice !== undefined)
  const reached = isBelowWish(price, saved.wishPrice)

  async function handleSet() {
    const text = await promptDialog({
      title: de.wish.title(name),
      label: de.wish.label,
      value: saved.wishPrice === undefined ? '' : de.wish.amountInput(saved.wishPrice),
      confirmLabel: de.wish.confirm,
    })
    const amount = text === null ? undefined : parseAmount(text)
    if (amount !== undefined) setWishPrice(listId, saved.cardId, saved.lang, amount)
  }

  if (saved.wishPrice === undefined) {
    return (
      <button type="button" onClick={handleSet} className="mt-1 text-xs text-muted underline-offset-2 hover:text-text hover:underline">
        {de.wish.set}
      </button>
    )
  }
  return (
    <div data-testid="wish-price" data-reached={reached} className="mt-1 text-xs">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={handleSet} className="min-w-0 truncate text-muted hover:text-text">
          {de.wish.wish(saved.wishPrice)}
        </button>
        <button
          type="button"
          aria-label={de.wish.remove(name)}
          onClick={() => setWishPrice(listId, saved.cardId, saved.lang, undefined)}
          className="shrink-0 rounded-control px-1 text-muted hover:bg-raised hover:text-text"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {price !== undefined && (
        <p
          className={
            reached
              ? 'mt-0.5 inline-block rounded-control border border-accent px-1.5 py-0.5 font-medium text-text'
              : 'mt-0.5 text-muted'
          }
        >
          {reached ? de.wish.reached(price) : de.wish.now(price)}
        </p>
      )}
    </div>
  )
}
