import { useId, useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { compareVariants, type CardLang, type CardVariant } from '../../types/binder'
import { useWatchlistStore } from '../../store/watchlistStore'
import { AddToBinder } from '../binder/AddToBinder'
import { useCardDetail, useCardLangs, usePrice } from '../binder/useCard'
import { SimilarCardsSection } from '../similar/SimilarCardsSection'
import { CardHoldingsInfo } from './CardHoldingsInfo'
import { CardImage } from './CardImage'
import { isSaved } from './watchlist'
import { listName } from './listName'

interface CardInfoDialogProps {
  card: CardSummary
  set: SetSummary | undefined
  /** Language the card was found in. */
  lang: CardLang
  onClose: () => void
}

function VariantPrice({ cardId, variant, lang }: { cardId: string; variant: CardVariant; lang: CardLang }) {
  const price = usePrice(cardId, variant, lang)
  return (
    <li data-testid="card-info-variant" className="flex items-baseline justify-between gap-3">
      <span>{de.variantLabel(variant)}</span>
      <span className={price ? 'font-medium' : 'text-muted'}>
        {price === undefined ? de.price.loading : price === null ? de.price.none : de.price.amount(price)}
      </span>
    </li>
  )
}

/**
 * A closer look at a card from the search before it goes into the binder: its picture in
 * large, the languages and finishes it exists in, its rarity and what it costs.
 */
export function CardInfoDialog({ card, set, lang, onClose }: CardInfoDialogProps) {
  const detail = useCardDetail(card.id, lang)
  const langs = useCardLangs(card.id, lang)
  const lists = useWatchlistStore((state) => state.lists)
  const toggleSaved = useWatchlistStore((state) => state.toggle)
  const createList = useWatchlistStore((state) => state.create)
  const [newList, setNewList] = useState('')
  const [showingSimilar, setShowingSimilar] = useState(false)
  // counted up when the card is put into a binder from here: what is in the collection is read anew
  const [added, setAdded] = useState(0)
  const savedOn = lists.filter((list) => isSaved(list.cards, card.id, lang)).map(listName)
  // the info of a similar card opens on top of this one, so the title needs an id of its own
  const titleId = useId()

  /** A list made from here is one the card is meant for. */
  function handleNewList(event: FormEvent) {
    event.preventDefault()
    const id = createList(newList)
    if (!id) return
    toggleSaved(id, card.id, lang)
    setNewList('')
  }
  // nothing is listed until TCGdex has said which finishes the card really exists in
  const variants = [...(detail?.variants ?? [])].sort(compareVariants)
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // the info of a similar card lies on top of this one: only the top one closes
        event.stopPropagation()
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="m-auto flex w-full max-w-2xl flex-col gap-6 rounded-panel border border-line bg-panel p-6 text-left shadow-lg sm:flex-row sm:flex-wrap"
      >
        <div className="mx-auto w-full max-w-64 shrink-0 sm:w-64">
          <CardImage card={card} set={set} size="large" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 text-sm">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">
              {card.name}
            </h2>
            <p className="mt-1 text-muted">{set ? `${set.name} · ${number}` : number}</p>
          </div>

          <dl className="space-y-4">
            <div className="space-y-1">
              <dt className="text-muted">{de.selection.rarity}</dt>
              <dd data-testid="card-info-rarity">{detail?.rarity ?? de.selection.unknown}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted">{de.cardInfo.languages}</dt>
              <dd data-testid="card-info-languages">{langs.map((entry) => de.languages[entry]).join(', ')}</dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-baseline justify-between gap-3 text-muted">
                <span>{de.cardInfo.variants}</span>
                <span>{de.price.label}</span>
              </dt>
              <dd>
                {variants.length === 0 ? (
                  <p className="text-muted">{detail ? de.selection.unknown : de.price.loading}</p>
                ) : (
                  <ul className="space-y-1">
                    {variants.map((variant) => (
                      <VariantPrice key={variant} cardId={card.id} variant={variant} lang={lang} />
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <CardHoldingsInfo cardId={card.id} version={added} />
          </dl>

          <AddToBinder cardId={card.id} lang={lang} onAdded={() => setAdded((count) => count + 1)} />

          {/* folded: with many lists, a row of boxes each would fill the window */}
          <details data-testid="card-info-lists" className="rounded-control border border-line bg-raised open:pb-3">
            <summary className="flex h-10 cursor-pointer items-center gap-2 px-3 text-sm marker:text-muted">
              <span className="text-muted">{de.watchlist.lists}:</span>
              <span className="min-w-0 truncate">{savedOn.length === 0 ? de.watchlist.onNone : savedOn.join(', ')}</span>
            </summary>
            <div className="space-y-2 px-3 pt-1">
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {lists.map((list) => (
                  <li key={list.id}>
                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-control px-1 hover:bg-panel">
                      <input
                        type="checkbox"
                        checked={isSaved(list.cards, card.id, lang)}
                        onChange={() => toggleSaved(list.id, card.id, lang)}
                        className="size-4 shrink-0 accent-accent"
                      />
                      <span className="min-w-0 truncate">{listName(list)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleNewList} className="flex gap-2">
                <input
                  type="text"
                  value={newList}
                  onChange={(event) => setNewList(event.target.value)}
                  placeholder={de.watchlist.newListPlaceholder}
                  aria-label={de.watchlist.newListField}
                  className="h-9 min-w-0 flex-1 rounded-control border border-line bg-panel px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={newList.trim() === ''}
                  className="h-9 rounded-control border border-line bg-panel px-3 text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
                >
                  {de.watchlist.create}
                </button>
              </form>
            </div>
          </details>

          <div className="mt-auto flex flex-wrap justify-end gap-3">
            <button
              type="button"
              aria-expanded={showingSimilar}
              title={de.similar.buttonHint}
              onClick={() => setShowingSimilar((showing) => !showing)}
              className={`h-10 rounded-control border bg-raised px-4 text-sm hover:border-accent ${showingSimilar ? 'border-accent' : 'border-line'}`}
            >
              {de.similar.button}
            </button>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
            >
              {de.cardInfo.close}
            </button>
          </div>
        </div>
        {showingSimilar && <SimilarCardsSection cardId={card.id} lang={lang} />}
      </div>
    </div>
  )
}
